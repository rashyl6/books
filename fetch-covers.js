/**
 * Cover Fetcher Script
 * Run with: node fetch-covers.js
 *
 * This script fetches book covers and saves them locally for reliable loading.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const BOOKBEAT_FILE = 'BookBeat.json';
const COVERS_DIR = 'covers';
const COVERS_MAP_FILE = 'covers.json';
const DELAY_BETWEEN_REQUESTS = 500; // ms - be nice to APIs

// Ensure covers directory exists
if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR);
}

// Load BookBeat data
function loadBooks() {
    const data = JSON.parse(fs.readFileSync(BOOKBEAT_FILE, 'utf8'));
    const books = [];

    for (const category of data) {
        if (category.type === 'myfinishedbooks' || category.type === 'mysavedbooks') {
            for (const book of category.books || []) {
                if (book.title && book.editions) {
                    const isbns = [];
                    for (const edition of book.editions) {
                        if (edition.isbn) {
                            isbns.push(String(edition.isbn).replace(/[^0-9X]/gi, ''));
                        }
                    }
                    if (isbns.length > 0) {
                        books.push({
                            id: book.bookId || book.bookid,
                            title: book.title,
                            isbns: isbns
                        });
                    }
                }
            }
        }
    }

    // Remove duplicates by ID
    const seen = new Set();
    return books.filter(book => {
        if (seen.has(book.id)) return false;
        seen.add(book.id);
        return true;
    });
}

// Fetch URL and return buffer
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        client.get(url, { headers: { 'User-Agent': 'BookCoverFetcher/1.0' } }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Fetch JSON from URL
async function fetchJson(url) {
    const buffer = await fetchUrl(url);
    return JSON.parse(buffer.toString('utf8'));
}

// Try to get cover from Open Library
async function tryOpenLibrary(isbn) {
    try {
        // First, search for the book to get cover_i
        const searchUrl = `https://openlibrary.org/search.json?isbn=${isbn}&limit=1`;
        const searchData = await fetchJson(searchUrl);

        if (searchData.docs && searchData.docs[0] && searchData.docs[0].cover_i) {
            const coverId = searchData.docs[0].cover_i;
            const coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
            const imageData = await fetchUrl(coverUrl);

            // Check it's not a tiny placeholder
            if (imageData.length > 1000) {
                return {
                    buffer: imageData,
                    author: searchData.docs[0].author_name?.[0] || null
                };
            }
        }

        // Also try direct ISBN cover URL
        const directUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        const directData = await fetchUrl(directUrl);
        if (directData.length > 1000) {
            return { buffer: directData, author: null };
        }
    } catch (e) {
        // Ignore errors, will try next source
    }
    return null;
}

// Try to get cover from Google Books
async function tryGoogleBooks(isbn) {
    try {
        const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
        const searchData = await fetchJson(searchUrl);

        if (searchData.items && searchData.items[0]) {
            const item = searchData.items[0];
            const imageLinks = item.volumeInfo?.imageLinks;

            if (imageLinks) {
                // Prefer larger images
                const imageUrl = (imageLinks.large || imageLinks.medium || imageLinks.thumbnail || imageLinks.smallThumbnail)
                    .replace('http://', 'https://')
                    .replace('&edge=curl', '');

                const imageData = await fetchUrl(imageUrl);

                // Check it's a real image (not tiny placeholder)
                if (imageData.length > 2000) {
                    const author = item.volumeInfo?.authors?.[0] || null;
                    return { buffer: imageData, author };
                }
            }
        }
    } catch (e) {
        // Ignore errors
    }
    return null;
}

// Try Open Library title search as last resort
async function tryOpenLibraryTitleSearch(title) {
    try {
        // Clean title for search
        const searchTitle = title
            .split(':')[0]
            .split('.')[0]
            .replace(/[^\w\s]/g, ' ')
            .trim();

        const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(searchTitle)}&limit=5`;
        const searchData = await fetchJson(searchUrl);

        // Find first result with a cover
        const withCover = searchData.docs?.find(doc => doc.cover_i);

        if (withCover && withCover.cover_i) {
            const coverUrl = `https://covers.openlibrary.org/b/id/${withCover.cover_i}-L.jpg`;
            const imageData = await fetchUrl(coverUrl);

            if (imageData.length > 1000) {
                return {
                    buffer: imageData,
                    author: withCover.author_name?.[0] || null
                };
            }
        }
    } catch (e) {
        // Ignore errors
    }
    return null;
}

// Try to get just author info (no cover) as final fallback
async function tryGetAuthorOnly(isbns, title) {
    // Try Google Books first (better author data)
    for (const isbn of isbns) {
        try {
            const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
            const searchData = await fetchJson(searchUrl);
            if (searchData.items && searchData.items[0]) {
                const author = searchData.items[0].volumeInfo?.authors?.[0];
                if (author) return author;
            }
        } catch (e) {
            // Continue to next
        }
    }

    // Try Open Library title search
    try {
        const searchTitle = title.split(':')[0].split('.')[0].replace(/[^\w\s]/g, ' ').trim();
        const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(searchTitle)}&limit=1`;
        const searchData = await fetchJson(searchUrl);
        if (searchData.docs && searchData.docs[0]) {
            return searchData.docs[0].author_name?.[0] || null;
        }
    } catch (e) {
        // Ignore
    }

    return null;
}

// Main function
async function main() {
    console.log('Loading books from BookBeat.json...');
    const books = loadBooks();
    console.log(`Found ${books.length} unique books\n`);

    // Load existing covers.json to preserve author info
    let existingCoversMap = {};
    if (fs.existsSync(COVERS_MAP_FILE)) {
        try {
            existingCoversMap = JSON.parse(fs.readFileSync(COVERS_MAP_FILE, 'utf8'));
        } catch (e) {
            // Ignore
        }
    }

    const coversMap = {};
    let found = 0;
    let notFound = 0;

    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        const progress = `[${i + 1}/${books.length}]`;

        // Check if we already have this cover
        const coverPath = path.join(COVERS_DIR, `${book.id}.jpg`);
        const existingEntry = existingCoversMap[book.id];

        if (fs.existsSync(coverPath)) {
            console.log(`${progress} SKIP: ${book.title} (already downloaded)`);
            coversMap[book.id] = { path: `covers/${book.id}.jpg`, author: existingEntry?.author || null };
            found++;
            continue;
        }

        // If we previously tried and found no cover, but have author, keep that
        if (existingEntry && existingEntry.path === null && existingEntry.author) {
            console.log(`${progress} SKIP: ${book.title} (no cover, has author)`);
            coversMap[book.id] = existingEntry;
            notFound++;
            continue;
        }

        console.log(`${progress} Fetching: ${book.title}`);

        let result = null;

        // Try each ISBN with Open Library
        for (const isbn of book.isbns) {
            result = await tryOpenLibrary(isbn);
            if (result) {
                console.log(`  -> Found via Open Library (ISBN: ${isbn})`);
                break;
            }
        }

        // Try each ISBN with Google Books
        if (!result) {
            for (const isbn of book.isbns) {
                result = await tryGoogleBooks(isbn);
                if (result) {
                    console.log(`  -> Found via Google Books (ISBN: ${isbn})`);
                    break;
                }
            }
        }

        // Try title search as last resort
        if (!result) {
            result = await tryOpenLibraryTitleSearch(book.title);
            if (result) {
                console.log(`  -> Found via title search`);
            }
        }

        if (result) {
            // Save cover image
            fs.writeFileSync(coverPath, result.buffer);
            coversMap[book.id] = {
                path: `covers/${book.id}.jpg`,
                author: result.author
            };
            found++;
        } else {
            // No cover found, but still try to get author info
            console.log(`  -> No cover found, searching for author...`);
            const author = await tryGetAuthorOnly(book.isbns, book.title);
            if (author) {
                console.log(`  -> Found author: ${author}`);
            }
            coversMap[book.id] = { path: null, author: author };
            notFound++;
        }

        // Be nice to APIs
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    // Save covers map
    fs.writeFileSync(COVERS_MAP_FILE, JSON.stringify(coversMap, null, 2));

    console.log('\n========================================');
    console.log(`Done! Found covers for ${found}/${books.length} books (${Math.round(found/books.length*100)}%)`);
    console.log(`Covers saved to: ${COVERS_DIR}/`);
    console.log(`Mapping saved to: ${COVERS_MAP_FILE}`);
    console.log('========================================\n');
}

main().catch(console.error);
