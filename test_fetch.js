
async function main() {
    const url = "https://recruitmentrawaes.sgp1.digitaloceanspaces.com/homemaid-images/homemaid-profile-1770011838979.jpg";
    try {
        console.log(`Fetching ${url}...`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        console.log(`Successfully fetched image. Size: ${buffer.byteLength} bytes`);
    } catch (error) {
        console.error('Fetch failed:', error.message);
    }
}

main();
