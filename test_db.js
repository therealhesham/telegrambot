const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        const count = await prisma.homemaid.count();
        console.log(`Total records in 'homemaid': ${count}`);

        if (count > 0) {
            const records = await prisma.homemaid.findMany({
                take: 5,
                select: {
                    id: true,
                    Name: true,
                    Picture: true,
                    FullPicture: true
                }
            });
            console.log('Sample records:', records);
        } else {
            console.log("Table 'homemaid' is empty.");
        }

        // Test specific search
        const searchTerm = 'Begum';
        console.log(`Testing search for: "${searchTerm}"`);
        const searchResults = await prisma.homemaid.findMany({
            where: {
                Name: {
                    contains: searchTerm
                }
            },
            select: { Name: true, Picture: true }
        });
        console.log(`Found ${searchResults.length} matches for "${searchTerm}"`);

    } catch (error) {
        console.error('Database Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
