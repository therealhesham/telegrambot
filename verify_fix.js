
const { Telegraf } = require('telegraf');

// Mock Telegraf context
const ctx = {
    replyWithPhoto: async (photo, options) => {
        console.log('--- replyWithPhoto Called ---');
        if (photo.source && Buffer.isBuffer(photo.source)) {
            console.log(`Success: Received Buffer of size ${photo.source.length} bytes`);
            console.log(`Caption: ${options.caption}`);
            return true;
        } else {
            console.error('Error: Expected photo.source to be a Buffer');
            return false;
        }
    },
    reply: (msg) => console.log(`ctx.reply: ${msg}`)
};

// Logic extracted from index.js for testing
async function testImageFetch() {
    const imageUrl = "https://recruitmentrawaes.sgp1.digitaloceanspaces.com/homemaid-images/homemaid-profile-1770011838979.jpg";
    const recordName = "Test User";

    try {
        console.log(`Fetching image: ${imageUrl}`);
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await ctx.replyWithPhoto({ source: buffer }, { caption: recordName });

    } catch (error) {
        console.error('Test Error:', error);
    }
}

testImageFetch();
