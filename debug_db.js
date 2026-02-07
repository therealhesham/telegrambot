
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const results = await prisma.homemaid.findMany({
            take: 5,
            select: {
                id: true,
                Name: true,
                Picture: true,
                FullPicture: true,
            }
        });
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
