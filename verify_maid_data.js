
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugMaidData() {
    try {
        console.log('Fetching first 5 maids with office details...');
        const maids = await prisma.homemaid.findMany({
            take: 5,
            select: {
                id: true,
                Name: true,
                officeName: true,
                office: {
                    select: {
                        office: true,
                        Country: true
                    }
                }
            }
        });

        console.log('Maids found:', JSON.stringify(maids, null, 2));

        const totalMaids = await prisma.homemaid.count();
        console.log(`Total maids in DB: ${totalMaids}`);

        const maidsWithOffice = await prisma.homemaid.count({
            where: {
                officeName: {
                    not: null
                }
            }
        });
        console.log(`Maids with non-null officeName: ${maidsWithOffice}`);

    } catch (error) {
        console.error('Error during debug:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugMaidData();
