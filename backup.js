// require('dotenv').config();
// const { Telegraf, Markup } = require('telegraf');
// const { PrismaClient } = require('@prisma/client');
// const fs = require('fs');
// const path = require('path');

// // Initialize Prisma Client
// const prisma = new PrismaClient();

// // Initialize Telegraf Bot
// if (!process.env.TG_TOKEN) {
//     console.error('Error: TG_TOKEN is missing in .env file');
//     process.exit(1);
// }
// const bot = new Telegraf(process.env.TG_TOKEN);

// // Start Command
// bot.start((ctx) => {
//     ctx.reply('Welcome! Send me a name to search for a CV.');
// });
// bot.telegram.getMe().then(console.log);

// // Help Command
// bot.help((ctx) => {
//     ctx.reply('Just type a name (e.g., "Ahmed") to search for their CV.');
// });

// // Search Logic
// bot.on('text', async (ctx) => {
//     const query = ctx.message.text.trim();
//     if (query.length < 2) {
//         return ctx.reply('ادخل اسم العاملة اول 4 حروف');
//     }

//     try {
//         console.log(`Searching for: "${query}"`); // Debug log

//         // Search in homemaid table by Name
//         // Using 'contains' for partial matching.
//         // Note: Assuming 'Name' is the correct column.
//         const results = await prisma.homemaid.findMany({
//             where: {
//                 Name: {
//                     contains: query,
//                 },
//             },
//             take: 10, // Limit results
//             select: {
//                 id: true,
//                 Name: true,
//                 Picture: true,
//                 FullPicture: true,
//             },
//         });

//         console.log(`Found ${results.length} results`); // Debug log

//         if (results.length === 0) {
//             return ctx.reply('No matches found for that name.');
//         }

//         // Create buttons for results
//         const buttons = results.map((record) => {
//             // Use a consistent callback data format: 'get_cv_<id>'
//             return Markup.button.callback(record.Name || 'Unknown Name', `get_cv_${record.id}`);
//         });

//         // Send the list as an inline keyboard
//         // Arrange in columns of 1 for readability
//         const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 });

//         await ctx.reply(`Found ${results.length} matches. Select one to view profile picture:`, keyboard);

//     } catch (error) {
//         console.error('Search Error:', error);
//         ctx.reply('An error occurred while searching the database. Please try again later.');
//     }
// });

// // CV Download Logic (Callback Query)
// bot.action(/get_cv_(\d+)/, async (ctx) => {
//     const id = parseInt(ctx.match[1], 10);

//     try {
//         const record = await prisma.homemaid.findUnique({
//             where: { id: id },
//             select: { Name: true, Picture: true, FullPicture: true },
//         });

//         if (!record) {
//             return ctx.reply('Record not found.');
//         }

//         // Determine the image URL
//         // Priority: FullPicture > Picture
//         // Formats: String URL or JSON { url: "..." }
//         let imageUrl = null;

//         const extractUrl = (field) => {
//             if (!field) return null;
//             if (typeof field === 'string') return field;
//             if (typeof field === 'object' && field.url) return field.url;
//             return null;
//         };

//         imageUrl = extractUrl(record.FullPicture) || extractUrl(record.Picture);

//         if (!imageUrl) {
//             return ctx.reply('No profile picture available for this person.');
//         }

//         console.log(`Sending image for ${record.Name}: ${imageUrl}`);

//         // Send the image
//         await ctx.replyWithPhoto({ url: imageUrl }, { caption: record.Name || 'Profile Picture' });

//     } catch (error) {
//         console.error('Image Send Error:', error);
//         ctx.reply('Failed to retrieve the image. It might be inaccessible.');
//     }
// });

// // Graceful Stop
// process.once('SIGINT', () => bot.stop('SIGINT'));
// process.once('SIGTERM', () => bot.stop('SIGTERM'));

// // Launch the bot
// bot.launch().then(() => {
//     console.log('Bot is running...');
// }).catch((err) => {
//     console.error('Failed to launch bot:', err);
// });










// require('dotenv').config();
// const { Telegraf, Markup } = require('telegraf');
// const { PrismaClient } = require('@prisma/client');
// const fs = require('fs');
// const path = require('path');

// // Initialize Prisma Client
// const prisma = new PrismaClient();

// // Initialize Telegraf Bot
// if (!process.env.TG_TOKEN) {
//     console.error('Error: TG_TOKEN is missing in .env file');
//     process.exit(1);
// }
// const bot = new Telegraf(process.env.TG_TOKEN);

// // Start Command
// bot.start((ctx) => {
//     ctx.reply('Welcome! Send me a name to search for a CV.');
// });
// bot.telegram.getMe().then(console.log);

// // Help Command
// bot.help((ctx) => {
//     ctx.reply('Just type a name (e.g., "Ahmed") to search for their CV.');
// });

// // Search Logic
// bot.on('text', async (ctx) => {
//     const query = ctx.message.text.trim();
//     if (query.length < 2) {
//         return ctx.reply('ادخل اسم العاملة اول 4 حروف');
//     }

//     try {
//         console.log(`Searching for: "${query}"`); // Debug log

//         // Search in homemaid table by Name
//         // Using 'contains' for partial matching.
//         // Note: Assuming 'Name' is the correct column.
//         const results = await prisma.homemaid.findMany({
//             where: {
//                 Name: {
//                     contains: query,
//                 },
//             },
//             take: 10, // Limit results
//             select: {
//                 id: true,
//                 Name: true,
//                 Picture: true,
//                 FullPicture: true,
//             },
//         });

//         console.log(`Found ${results.length} results`); // Debug log

//         if (results.length === 0) {
//             return ctx.reply('No matches found for that name.');
//         }

//         // Create buttons for results
//         const buttons = results.map((record) => {
//             // Use a consistent callback data format: 'get_cv_<id>'
//             return Markup.button.callback(record.Name || 'Unknown Name', `get_cv_${record.id}`);
//         });

//         // Send the list as an inline keyboard
//         // Arrange in columns of 1 for readability
//         const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 });

//         await ctx.reply(`Found ${results.length} matches. Select one to view profile picture:`, keyboard);

//     } catch (error) {
//         console.error('Search Error:', error);
//         ctx.reply('An error occurred while searching the database. Please try again later.');
//     }
// });

// // CV Download Logic (Callback Query)
// bot.action(/get_cv_(\d+)/, async (ctx) => {
//     const id = parseInt(ctx.match[1], 10);

//     try {
//         const record = await prisma.homemaid.findUnique({
//             where: { id: id },
//             select: { Name: true, Picture: true, FullPicture: true },
//         });

//         if (!record) {
//             return ctx.reply('Record not found.');
//         }

//         // Determine the image URL
//         // Priority: FullPicture > Picture
//         // Formats: String URL or JSON { url: "..." }
//         let imageUrl = null;

//         const extractUrl = (field) => {
//             if (!field) return null;
//             if (typeof field === 'string') return field;
//             if (typeof field === 'object' && field.url) return field.url;
//             return null;
//         };

//         imageUrl = extractUrl(record.FullPicture) || extractUrl(record.Picture);

//         if (!imageUrl) {
//             return ctx.reply('No profile picture available for this person.');
//         }

//         console.log(`Fetching image for ${record.Name}: ${imageUrl}`);

//         // Fetch the image data
//         const response = await fetch(imageUrl);

//         if (!response.ok) {
//             throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
//         }

//         const arrayBuffer = await response.arrayBuffer();
//         const buffer = Buffer.from(arrayBuffer);

//         console.log(`Image fetched successfully. Buffer size: ${buffer.length} bytes`);

//         // Save to a temporary file to ensure valid file handling
//         const tempFilePath = path.join(__dirname, `temp_image_${id}.jpg`);
//         fs.writeFileSync(tempFilePath, buffer);
//         console.log(`Saved to temporary file: ${tempFilePath}`);

//         // Send the image using a stream
//         await ctx.replyWithPhoto({ source: fs.createReadStream(tempFilePath) }, { caption: record.Name || 'Profile Picture' });

//         console.log('Image sent successfully to Telegram.');

//         // Cleanup
//         fs.unlinkSync(tempFilePath);
//         console.log('Temporary file deleted.');

//     } catch (error) {
//         console.error('Image Send Error:', error);
//         ctx.reply('Failed to retrieve the image. It might be inaccessible.');
//     }
// });

// // Graceful Stop
// process.once('SIGINT', () => bot.stop('SIGINT'));
// process.once('SIGTERM', () => bot.stop('SIGTERM'));

// // Launch the bot
// bot.launch().then(() => {
//     console.log('Bot is running...');
// }).catch((err) => {
//     console.error('Failed to launch bot:', err);
// });
