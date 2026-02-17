
// scripts/test_wiki_image.js
async function run() {
    const name = "William Ruto";
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;

    console.log("Fetching:", url);
    try {
        const response = await fetch(url);
        const data = await response.json();
        // console.log(JSON.stringify(data, null, 2));

        if (data.query && data.query.pages) {
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pageId !== "-1") {
                const page = pages[pageId];
                if (page.thumbnail) {
                    console.log("Image URL:", page.thumbnail.source);
                } else {
                    console.log("Page found based on title match, but no thumbnail.");
                }
            } else {
                console.log("Page not found for exact title.");
            }
        }
    } catch (e) { console.error(e); }
}
run();
