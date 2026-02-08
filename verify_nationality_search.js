
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyNationalitySearch() {
    try {
        console.log('Fetching unique countries from offices...');
        // Fetch unique countries from offices table
        const countries = await prisma.offices.findMany({
            distinct: ['Country'],
            select: {
                Country: true,
            },
            where: {
                Country: {
                    not: null
                }
            }
        });

        const uniqueCountries = countries.map(c => c.Country).filter(c => c && c.trim() !== '');
        console.log('Unique Countries found:', uniqueCountries);

        if (uniqueCountries.length === 0) {
            console.log('No countries found in offices table.');
            return;
        }

        const testCountry = 'Bangladesh - بنغلاديش'; // Hardcoded based on debug findings
        console.log(`Testing search for country: "${testCountry}"`);

        // Search for maids in this country
        const maids = await prisma.homemaid.findMany({
            where: {
                office: {
                    Country: testCountry,
                },
            },
            take: 5,
            select: {
                id: true,
                Name: true,
                office: {
                    select: {
                        Country: true,
                        office: true
                    }
                }
            }
        });

        console.log(`Found ${maids.length} maids for ${testCountry}:`);
        maids.forEach(maid => {
            console.log(`- ID: ${maid.id}, Name: ${maid.Name}, Office Country: ${maid.office?.Country}`);
        });

    } catch (error) {
        console.error('Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyNationalitySearch();
