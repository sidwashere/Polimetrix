
// scripts/test_ddg_image.js
// No imports needed for Node 18+ fetch
async function run() {
    const query = encodeURIComponent("William Ruto Kenya image");
    const url = `https://ddg-api.vercel.app/search?q=${query}&max_results=5`;

    console.log("Fetching:", url);
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.results) {
            console.log("Found results:", data.results.length);
            if (data.results.length > 0) {
                console.log("Example result keys:", Object.keys(data.results[0]));
            }

            const imageResult = data.results.find(r => r.image || r.thumbnail || r.src || (r.body && r.body.includes('http')));
            if (imageResult) {
                console.log("Found potential image in result:", imageResult);
            } else {
                console.log("No distinct image field found in results.");
            }

        } else {
            console.log("No results structure found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
