require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize Telegraf Bot
if (!process.env.TG_TOKEN) {
    console.error('Error: TG_TOKEN is missing in .env file');
    process.exit(1);
}
const bot = new Telegraf(process.env.TG_TOKEN);

// Start Command
bot.start((ctx) => {
    ctx.reply('مرحباً! الرجاء اختيار طريقة البحث:', Markup.inlineKeyboard([
        [Markup.button.callback('البحث بالاسم', 'search_name')],
        [Markup.button.callback('البحث برقم العاملة', 'search_id')],
        [Markup.button.callback('البحث بالجنسية', 'search_nationality')]
    ]));
});

// Help Command
bot.help((ctx) => {
    ctx.reply('اضغط لاختيار طريقة البحث:', Markup.inlineKeyboard([
        [Markup.button.callback('البحث بالاسم', 'search_name')],
        [Markup.button.callback('البحث برقم العاملة', 'search_id')],
        [Markup.button.callback('البحث بالجنسية', 'search_nationality')]
    ]));
});

// Search Mode Handlers
bot.action('search_name', async (ctx) => {
    await ctx.deleteMessage();
    await ctx.reply('الرجاء إدخال الاسم:', Markup.forceReply());
});

bot.action('search_id', async (ctx) => {
    await ctx.deleteMessage();
    await ctx.reply('الرجاء إدخال رقم العاملة:', Markup.forceReply());
});

bot.action('search_nationality', async (ctx) => {
    try {
        await ctx.deleteMessage();

        // Fetch unique countries from offices
        const countries = await prisma.offices.findMany({
            distinct: ['Country'],
            select: { Country: true },
            where: { Country: { not: null } }
        });

        const uniqueCountries = countries
            .map(c => c.Country)
            .filter(c => c && c.trim() !== '');

        if (uniqueCountries.length === 0) {
            return ctx.reply('لا توجد جنسيات متاحة حالياً.');
        }

        // Create buttons for each country
        // Callback data format: search_nat_{index} to keep it short, or just handle strict string matching
        // But since country names can be long or contain special chars, let's use a mapping approach or hash if needed.
        // Simple approach: `nat_${index}` and we store the list? No, stateless is better.
        // Let's try sending the country name if it fits. Max 64 bytes for callback data.
        // Some country names might be long "Philippines - الفلبين".
        // Let's use a prefix `nat_` and a short identifier or just the index if we re-fetch (might be inconsistent).
        // Better: `nat_${countryName.substring(0, 50)}`? No.
        // Let's use `nat_${index}` and we have to fetch the list again to map it back, OR we just trust the list order hasn't changed (risky but acceptable for low traffic).
        // Actually, let's put the country name directly if it's safe.
        // "Philippines - الفلبين" is ~25 chars (Arabic chars take 2 bytes). 25*2 = 50 bytes. tight.
        // Let's stringify the country into a shorter unique ID on the fly? No.
        // Let's use the ID of the ONE VALID office for that country? No, multiple offices per country.
        // Let's iterate and use the index from the sorted list found in DB.

        const buttons = uniqueCountries.map((country, index) => {
            // We'll use a local in-memory cache or just re-fetch.
            // For simplicity here, let's pass the country name but truncated/cleaned if needed.
            // actually, the user wants "intelligent search".
            // Let's just pass `nat_${index}` and re-fetch the sorted unique list in the handler.
            return [Markup.button.callback(country, `nat_${index}`)];
        });

        await ctx.reply('الرجاء اختيار الجنسية:', Markup.inlineKeyboard(buttons));

    } catch (error) {
        console.error('Error fetching nationalities:', error);
        ctx.reply('فشل في جلب الجنسيات.');
    }
});

// Handler for Country Selection
bot.action(/nat_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1], 10);

    try {
        // Re-fetch to get the correct country string
        const countries = await prisma.offices.findMany({
            distinct: ['Country'],
            select: { Country: true },
            where: { Country: { not: null } }
        });

        const uniqueCountries = countries
            .map(c => c.Country)
            .filter(c => c && c.trim() !== '');

        if (index < 0 || index >= uniqueCountries.length) {
            return ctx.reply('اختيار غير صحيح. الرجاء المحاولة مرة أخرى.');
        }

        const selectedCountry = uniqueCountries[index];
        await ctx.deleteMessage();
        await ctx.reply(`جاري البحث عن عاملات من: ${selectedCountry}...`);

        // Search logic
        const results = await prisma.homemaid.findMany({
            where: {
                office: {
                    Country: selectedCountry
                }
            },
            take: 10, // Limit results
            select: {
                id: true,
                Name: true
            }
        });

        if (results.length === 0) {
            return ctx.reply(`لم يتم العثور على عاملات من ${selectedCountry}.`, Markup.inlineKeyboard([
                [Markup.button.callback('البحث بالجنسية', 'search_nationality')],
                [Markup.button.callback('العودة للقائمة الرئيسية', '/start')]
            ]));
        }

        const buttons = results.map((record) => {
            return Markup.button.callback(record.Name || 'اسم غير معروف', `get_cv_${record.id}`);
        });

        const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 });
        await ctx.reply(`تم العثور على ${results.length} نتيجة. اختر واحدة لإنشاء السيرة الذاتية PDF:`, keyboard);

    } catch (error) {
        console.error('Error searching by nationality:', error);
        ctx.reply('حدث خطأ أثناء البحث.');
    }
});

// Search Logic
bot.on('text', async (ctx) => {
    const query = ctx.message.text.trim();
    const replyMessage = ctx.message.reply_to_message;

    if (!replyMessage) {
        return ctx.reply('الرجاء اختيار طريقة البحث أولاً:', Markup.inlineKeyboard([
            [Markup.button.callback('البحث بالاسم', 'search_name')],
            [Markup.button.callback('البحث برقم الهوية', 'search_id')],
            [Markup.button.callback('البحث بالجنسية', 'search_nationality')]
        ]));
    }

    const promptText = replyMessage.text;

    try {
        let results = [];

        if (promptText === 'الرجاء إدخال الاسم:' || promptText === 'Please enter the name:') {
            if (query.length < 2) {
                return ctx.reply('الرجاء إدخال حرفين على الأقل للبحث.', Markup.forceReply());
            }

            console.log(`Searching by Name: "${query}"`);
            results = await prisma.homemaid.findMany({
                where: {
                    Name: {
                        contains: query,
                    },
                },
                take: 10,
                select: {
                    id: true,
                    Name: true,
                },
            });

        } else if (promptText === 'الرجاء إدخال رقم الهوية:' || promptText === 'Please enter the ID:') {
            const searchId = parseInt(query, 10);
            if (isNaN(searchId)) {
                return ctx.reply('الرجاء إدخال رقم هوية صحيح.', Markup.forceReply());
            }

            console.log(`Searching by ID: "${searchId}"`);
            // Exact match for ID
            const record = await prisma.homemaid.findUnique({
                where: { id: searchId },
                select: {
                    id: true,
                    Name: true,
                },
            });
            if (record) results.push(record);

        } else {
            // Unknown reply context
            return ctx.reply('الرجاء استخدام خيارات القائمة.', Markup.inlineKeyboard([
                [Markup.button.callback('البحث بالاسم', 'search_name')],
                [Markup.button.callback('البحث برقم الهوية', 'search_id')],
                [Markup.button.callback('البحث بالجنسية', 'search_nationality')]
            ]));
        }

        if (results.length === 0) {
            // Provide a way to try again easily
            return ctx.reply('لم يتم العثور على نتائج. المحاولة مرة أخرى؟', Markup.inlineKeyboard([
                [Markup.button.callback('البحث بالاسم', 'search_name')],
                [Markup.button.callback('البحث برقم الهوية', 'search_id')],
                [Markup.button.callback('البحث بالجنسية', 'search_nationality')]
            ]));
        }

        const buttons = results.map((record) => {
            return Markup.button.callback(record.Name || 'اسم غير معروف', `get_cv_${record.id}`);
        });

        const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 });

        await ctx.reply(`تم العثور على ${results.length} نتيجة. اختر واحدة لإنشاء السيرة الذاتية PDF:`, keyboard);

    } catch (error) {
        console.error('Search Error:', error);
        ctx.reply('حدث خطأ أثناء البحث في قاعدة البيانات.');
    }
});

// Helper Functions
const getDate = (date) => {
    if (!date) return "غير متوفر";
    const currentDate = new Date(date);
    if (isNaN(currentDate.getTime())) return "غير متوفر";
    return `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
};

const calculateAge = (birthDate) => {
    if (!birthDate) return "";
    const birth = new Date(birthDate);
    const today = new Date();
    if (isNaN(birth.getTime())) return "";
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age.toString();
};

const getStars = (level) => {
    const levelMap = {
        "Expert - ممتاز": 5,
        "Advanced - جيد جداً": 4,
        "Intermediate - جيد": 3,
        "Beginner - مبتدأ": 2,
        "Non - لا تجيد": 1,
    };
    const stars = levelMap[level] || 0;
    return { filled: stars, empty: 5 - stars };
};

const renderStars = (level) => {
    const { filled, empty } = getStars(level);
    return `<span style="color: #0d4f4f;">${'★'.repeat(filled)}${'☆'.repeat(empty)}</span>`;
};

// CV Download Logic (Callback Query)
bot.action(/get_cv_(\d+)/, async (ctx) => {
    const id = parseInt(ctx.match[1], 10);
    let browser = null;

    try {
        await ctx.reply('جاري إنشاء ملف السيرة الذاتية (PDF)، الرجاء الانتظار...');

        // Fetch complete record
        const record = await prisma.homemaid.findUnique({
            where: { id: id },
            include: { office: true }
        });

        if (!record) {
            return ctx.reply('لم يتم العثور على السجل.');
        }

        // Image Handling
        let imageUrl = null;
        const extractUrl = (field) => {
            if (!field) return null;
            if (typeof field === 'string') return field;
            if (Array.isArray(field)) {
                const first = field[0];
                if (typeof first === 'string') return first;
                if (first && typeof first === 'object' && first.url) return first.url;
                return null;
            }
            if (typeof field === 'object' && field.url) return field.url;
            return null;
        };

        imageUrl = extractUrl(record.Picture);

        let imageBase64 = '';
        if (imageUrl) {
            try {
                // Determine if url is full or relative
                // Assuming URLs are absolute or relative to some base. The user code fetched it directly.
                // If allow fetch(imageUrl) works, then it's accessible.
                const imgResponse = await fetch(imageUrl);
                if (imgResponse.ok) {
                    const arrayBuffer = await imgResponse.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const mimeType = 'image/jpeg'; // fallback
                    // Start of base64 string
                    imageBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
                }
            } catch (e) {
                console.error('Failed to fetch image for PDF:', e);
            }
        }

        // HTML Template Construction
        const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                
                body {
                    font-family: 'Tajawal', sans-serif;
                    margin: 0;
                    padding: 0;
                    background: white;
                }
                .container {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                    padding: 8mm 10mm;
                    box-sizing: border-box;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px solid #0d4f4f;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                .title-sect {
                    text-align: right;
                }
                h1 {
                    font-size: 24px;
                    font-weight: bold;
                    color: #0d4f4f;
                    margin: 0;
                }
                .subtitle {
                    font-size: 14px;
                    color: #666;
                    margin: 4px 0 0;
                }
                .main-grid {
                    display: flex;
                    gap: 15px;
                }
                .right-col {
                    width: 35%;
                }
                .left-col {
                    width: 65%;
                }
                .photo-box {
                    width: 100%;
                    aspect-ratio: 3/4;
                    border: 2px solid #0d4f4f;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 12px;
                    background: #f5f5f5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .photo-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .name-badge {
                    background: #0d4f4f;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    text-align: center;
                    margin-bottom: 10px;
                    font-size: 16px;
                    font-weight: bold;
                }
                .quick-info {
                    background: #f8f9fa;
                    border-radius: 6px;
                    padding: 10px;
                    font-size: 11px;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 4px;
                }
                .info-label { color: #666; }
                .info-val { font-weight: bold; }
                .salary-box {
                    background: #0d4f4f;
                    color: white;
                    padding: 10px;
                    border-radius: 6px;
                    text-align: center;
                    margin-top: 10px;
                }
                .section-header {
                    background: #0d4f4f;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 4px 4px 0 0;
                    font-size: 13px;
                    font-weight: bold;
                }
                .section-content {
                    border: 1px solid #ddd;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    padding: 10px;
                    font-size: 11px;
                    margin-bottom: 12px;
                }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 4px 8px; }
                .td-label { color: #666; width: 25%; }
                .td-val { font-weight: bold; }
                .bg-light { background: #f9f9f9; }
                .skills-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                }
                .skill-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 8px;
                    border-radius: 3px;
                }
                .office-box {
                    background: #f0f7f7;
                    border-radius: 6px;
                    padding: 10px;
                    border: 1px solid #0d4f4f;
                    font-size: 11px;
                    display: flex;
                    justify-content: space-between;
                }
                .footer {
                    border-top: 2px solid #0d4f4f;
                    margin-top: 15px;
                    padding-top: 8px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="title-sect">
                        <h1>السيرة الذاتية</h1>
                        <p class="subtitle">CURRICULUM VITAE</p>
                    </div>
                   <!-- Logo Placeholder - Add actual URL if available -->
                </div>

                <div class="main-grid">
                    <div class="right-col">
                        <div class="photo-box">
                            ${imageBase64 ? `<img src="${imageBase64}" />` : '<span>لا توجد صورة</span>'}
                        </div>
                        <div class="name-badge">
                            ${record.Name || 'الاسم'}
                        </div>
                        <div class="quick-info">
                            <div class="info-row"><span class="info-label">حالة الاعتماد:</span><span class="info-val" style="color: ${record.isApproved ? '#0d4f4f' : '#dc3545'};">${record.isApproved ? 'معتمد' : 'غير معتمد'}</span></div>
                            <div class="info-row"><span class="info-label">العمر:</span><span class="info-val">${calculateAge(record.dateofbirth)} سنة</span></div>
                            <div class="info-row"><span class="info-label">الديانة:</span><span class="info-val">${(record.Religion || '').split(' - ')[1] || record.Religion || '-'}</span></div>
                            <div class="info-row"><span class="info-label">الجنسية:</span><span class="info-val">${record.Nationalitycopy || '-'}</span></div>
                            <div class="info-row"><span class="info-label">الحالة الاجتماعية:</span><span class="info-val">${(record.maritalstatus || '').split(' - ')[1] || record.maritalstatus || '-'}</span></div>
                            <div class="info-row"><span class="info-label">عدد الأطفال:</span><span class="info-val">${record.children || '0'}</span></div>
                            <div class="info-row"><span class="info-label">الطول:</span><span class="info-val">${record.height ? record.height + ' سم' : '-'}</span></div>
                            <div class="info-row"><span class="info-label">الوزن:</span><span class="info-val">${record.weight ? record.weight + ' كجم' : '-'}</span></div>
                        </div>
                        <div class="salary-box">
                            <p style="font-size: 10px; margin: 0 0 4px; opacity: 0.8;">الراتب الشهري</p>
                            <p style="font-size: 18px; fontWeight: bold; margin: 0;">${record.Salary || '-'} ريال</p>
                        </div>
                    </div>

                    <div class="left-col">
                        <!-- Personal Info -->
                        <div class="section-header">المعلومات الشخصية | Personal Information</div>
                        <div class="section-content">
                            <table>
                                <tr>
                                    <td class="td-label">تاريخ الميلاد:</td><td class="td-val">${getDate(record.dateofbirth)}</td>
                                    <td class="td-label">رقم الجواز:</td><td class="td-val">${record.Passportnumber || '-'}</td>
                                </tr>
                                <tr class="bg-light">
                                    <td class="td-label">بداية الجواز:</td><td class="td-val">${getDate(record.PassportStart || record.passportStartDate)}</td> <!-- Handle mismatch if any -->
                                    <td class="td-label">نهاية الجواز:</td><td class="td-val">${getDate(record.PassportEnd || record.passportEndDate)}</td>
                                </tr>
                                <tr>
                                    <td class="td-label">رقم الجوال:</td><td class="td-val" colspan="3">${record.phone || '-'}</td>
                                </tr>
                            </table>
                        </div>

                        <!-- Education -->
                        <div class="section-header">التعليم واللغات | Education & Languages</div>
                        <div class="section-content">
                            <table>
                                <tr>
                                    <td class="td-label">التعليم:</td><td class="td-val">${(record.Education || '').split(' - ')[1] || record.Education || '-'}</td>
                                </tr>
                                <tr class="bg-light">
                                    <td class="td-label">اللغة العربية:</td>
                                    <td>
                                        ${renderStars(record.ArabicLanguageLeveL)}
                                        <span style="font-size: 10px; color: #666;">(${(record.ArabicLanguageLeveL || '').split(' - ')[1] || record.ArabicLanguageLeveL || '-'})</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="td-label">اللغة الإنجليزية:</td>
                                    <td>
                                        ${renderStars(record.EnglishLanguageLevel)}
                                        <span style="font-size: 10px; color: #666;">(${(record.EnglishLanguageLevel || '').split(' - ')[1] || record.EnglishLanguageLevel || '-'})</span>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <!-- Experience -->
                        <div class="section-header">الخبرة | Experience</div>
                        <div class="section-content">
                             <table>
                                <tr>
                                    <td class="td-label">مستوى الخبرة:</td><td class="td-val">${(record.Experience || '').split(' | ')[1] || record.Experience || '-'}</td>
                                </tr>
                                <tr class="bg-light">
                                    <td class="td-label">سنوات الخبرة:</td><td class="td-val">${record.ExperienceYears || '-'}</td>
                                </tr>
                            </table>
                        </div>

                        <!-- Skills -->
                        <div class="section-header">المهارات | Skills</div>
                        <div class="section-content">
                            <div class="skills-grid">
                                ${[
                { l: 'الطبخ', v: record.CookingLevel || record.cookingLevel },
                { l: 'التنظيف', v: record.CleaningLevel || record.cleaningLevel },
                { l: 'الغسيل', v: record.WashingLevel || record.washingLevel },
                { l: 'الكوي', v: record.IroningLevel || record.ironingLevel },
                { l: 'الخياطة', v: record.SewingLevel || record.sewingLevel },
                { l: 'رعاية الأطفال', v: record.ChildcareLevel || record.childcareLevel },
                { l: 'رعاية الرضع', v: record.BabySitterLevel || record.babySitterLevel },
                { l: 'رعاية كبار السن', v: record.ElderlycareLevel || record.elderlycareLevel }
            ].map((s, idx) => `
                                    <div class="skill-item" style="background: ${idx % 2 === 0 ? '#f9f9f9' : 'white'};">
                                        <span style="color: #666; font-size: 10px;">${s.l}</span>
                                        ${renderStars(s.v)}
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Office -->
                        <div class="office-box">
                            <span style="color: #666;">مكتب الاستقدام:</span>
                            <span style="font-weight: bold; color: #0d4f4f;">${record.officeName || (record.office ? record.office.office : '-') || '-'}</span>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</span>
                    <span>رقم الهوية: ${record.id}</span>
                </div>
            </div>
        </body>
        </html>
        `;

        // Generate PDF
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

        const tempPdfPath = path.join(__dirname, `temp_cv_${id}.pdf`);
        fs.writeFileSync(tempPdfPath, pdfBuffer);

        await ctx.replyWithDocument({ source: fs.createReadStream(tempPdfPath), filename: `CV_${record.Name || 'Maid'}.pdf` });

        // Cleanup
        fs.unlinkSync(tempPdfPath);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        ctx.reply('فشل في إنشاء ملف PDF. الرجاء المحاولة مرة أخرى لاحقاً.');
    } finally {
        if (browser) await browser.close();
    }
});

// Graceful Stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Launch
bot.launch().then(() => {
    console.log('Bot is running...');
}).catch((err) => {
    console.error('Failed to launch bot:', err);
});
