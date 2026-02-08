
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeFilters() {
    try {
        console.log('Fetching distinct Religions...');
        const religions = await prisma.homemaid.findMany({
            distinct: ['Religion'],
            select: { Religion: true }
        });
        console.log('Religions:', religions.map(r => r.Religion));

        console.log('Fetching distinct Marital Statuses...');
        const statuses = await prisma.homemaid.findMany({
            distinct: ['maritalstatus'],
            select: { maritalstatus: true }
        });
        console.log('Marital Statuses:', statuses.map(s => s.maritalstatus));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeFilters();
