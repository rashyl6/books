/**
 * Books Page - BookBeat Reading List
 * Displays audiobooks from BookBeat JSON export
 */

(function() {
    'use strict';

    // ============================================
    // Configuration
    // ============================================

    const CONFIG = {
        dataFile: 'BookBeat.json',
        coversMapFile: 'covers.json',
        placeholderIcon: '📖'
    };

    // Covers map loaded from covers.json (pre-fetched by fetch-covers.js)
    let coversMap = {};

    // ============================================
    // State
    // ============================================

    let state = {
        finishedBooks: [],
        savedBooks: [],
        activeTab: 'finished'
    };

    // ============================================
    // Data Loading
    // ============================================

    async function loadData() {
        try {
            const response = await fetch(CONFIG.dataFile);
            if (!response.ok) {
                throw new Error(`Failed to load data: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error loading BookBeat data:', error);
            return null;
        }
    }

    // ============================================
    // Data Processing
    // ============================================

    function processBooks(data) {
        // BookBeat export is an array of category objects
        // Find the right category by type
        const findCategory = (type) => {
            if (Array.isArray(data)) {
                const category = data.find(item => item.type === type);
                return category ? category.books : [];
            }
            // Fallback for flat structure
            return data[type] || [];
        };

        const finishedRaw = findCategory('myfinishedbooks');
        const savedRaw = findCategory('mysavedbooks');

        // Process finished books
        state.finishedBooks = finishedRaw
            .map(book => ({
                title: book.title,
                bookId: book.bookId,
                isbns: extractAllISBNs(book.editions),
                finishedDate: book.finishedDate,
                year: extractYear(book.finishedDate)
            }))
            .filter(book => book.year && book.title) // Only include books with valid dates and titles
            .sort((a, b) => new Date(b.finishedDate) - new Date(a.finishedDate));

        // Process saved books
        state.savedBooks = savedRaw
            .map(book => ({
                title: book.title,
                bookId: book.bookid || book.bookId,
                isbns: extractAllISBNs(book.editions),
                date: book.date,
                year: extractYear(book.date)
            }))
            .filter(book => book.year && book.title) // Only include books with valid dates and titles
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    function extractAllISBNs(editions) {
        if (!editions || !Array.isArray(editions)) return [];

        // Collect all ISBNs, prioritizing eBook (better cover availability) then audioBook
        const isbns = [];

        // First add eBook ISBNs (most likely to have covers)
        for (const edition of editions) {
            if ((edition.format === 'eBook' || edition.type === 'eBook') && edition.isbn) {
                isbns.push(cleanISBN(edition.isbn));
            }
        }

        // Then add audioBook ISBNs as fallback
        for (const edition of editions) {
            if ((edition.format === 'audioBook' || edition.type === 'audioBook') && edition.isbn) {
                const cleaned = cleanISBN(edition.isbn);
                if (!isbns.includes(cleaned)) {
                    isbns.push(cleaned);
                }
            }
        }

        // Finally any other editions
        for (const edition of editions) {
            if (edition.isbn) {
                const cleaned = cleanISBN(edition.isbn);
                if (!isbns.includes(cleaned)) {
                    isbns.push(cleaned);
                }
            }
        }

        return isbns;
    }

    function extractISBN(editions) {
        const isbns = extractAllISBNs(editions);
        return isbns.length > 0 ? isbns[0] : null;
    }

    function cleanISBN(isbn) {
        // Remove any non-digit characters except X (for ISBN-10)
        return String(isbn).replace(/[^0-9X]/gi, '');
    }

    function extractYear(dateString) {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return null;
            return date.getFullYear();
        } catch {
            return null;
        }
    }

    function groupByYear(books) {
        const groups = {};
        books.forEach(book => {
            if (!groups[book.year]) {
                groups[book.year] = [];
            }
            groups[book.year].push(book);
        });

        // Sort years descending
        return Object.keys(groups)
            .sort((a, b) => b - a)
            .map(year => ({
                year: parseInt(year),
                books: groups[year]
            }));
    }

    // ============================================
    // Stats Calculation
    // ============================================

    function calculateStats() {
        const totalBooks = state.finishedBooks.length;
        const currentYear = new Date().getFullYear();
        const thisYearBooks = state.finishedBooks.filter(b => b.year === currentYear).length;

        const years = [...new Set(state.finishedBooks.map(b => b.year))];
        const yearsReading = years.length;

        return {
            totalBooks,
            thisYearBooks,
            yearsReading,
            currentYear
        };
    }

    // ============================================
    // Rendering
    // ============================================

    function renderStats() {
        const stats = calculateStats();

        document.getElementById('total-books').textContent = stats.totalBooks;
        document.getElementById('this-year-books').textContent = stats.thisYearBooks;
        document.getElementById('this-year-label').textContent = `In ${stats.currentYear}`;
        document.getElementById('years-reading').textContent = stats.yearsReading;

        document.getElementById('finished-count').textContent = state.finishedBooks.length;
        document.getElementById('saved-count').textContent = state.savedBooks.length;
    }

    function renderBooks() {
        renderBooksByYear('finished-books', state.finishedBooks, true);
        renderBooksByYear('saved-books', state.savedBooks, false);
    }

    function renderBooksByYear(containerId, books, showDate) {
        const container = document.getElementById(containerId);
        const yearGroups = groupByYear(books);

        if (yearGroups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <p>No books yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = yearGroups.map(group => `
            <section class="year-section">
                <header class="year-header">
                    <h2 class="year-title">${group.year}</h2>
                    <span class="year-count">${group.books.length} book${group.books.length !== 1 ? 's' : ''}</span>
                </header>
                <div class="books-grid">
                    ${group.books.map(book => renderBookCard(book, showDate)).join('')}
                </div>
            </section>
        `).join('');

        // Initialize cover loading
        initializeCoverLoading();
    }

    function renderBookCard(book, showDate) {
        const dateDisplay = showDate && book.finishedDate
            ? formatDate(book.finishedDate)
            : '';

        // Check if we have a local cover
        const coverInfo = coversMap[book.bookId] || {};
        const hasCover = coverInfo.path;
        const author = coverInfo.author || '';

        return `
            <article class="book-card">
                <div class="book-cover-wrapper">
                    ${hasCover ? `
                        <img
                            class="book-cover loaded"
                            src="${coverInfo.path}"
                            alt="${escapeHtml(book.title)}"
                            loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        />
                        <div class="book-placeholder" style="display: none;">
                            <span class="placeholder-icon">${CONFIG.placeholderIcon}</span>
                            <span class="placeholder-title">${escapeHtml(book.title)}</span>
                        </div>
                    ` : `
                        <img
                            class="book-cover loading"
                            data-isbns="${(book.isbns || []).join(',')}"
                            alt="${escapeHtml(book.title)}"
                            loading="lazy"
                        />
                        <div class="book-placeholder">
                            <span class="placeholder-icon">${CONFIG.placeholderIcon}</span>
                            <span class="placeholder-title">${escapeHtml(book.title)}</span>
                        </div>
                    `}
                </div>
                <h3 class="book-title">${escapeHtml(book.title)}</h3>
                ${author ? `<div class="book-author">${escapeHtml(author)}</div>` : ''}
                ${dateDisplay ? `<div class="book-date">${dateDisplay}</div>` : ''}
            </article>
        `;
    }

    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return '';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // Cover Image Loading
    // ============================================

    function initializeCoverLoading() {
        // For books without local covers, just show the placeholder
        // Local covers are pre-fetched by fetch-covers.js
        const images = document.querySelectorAll('.book-cover.loading');

        images.forEach((img) => {
            const placeholder = img.parentElement.querySelector('.book-placeholder');
            // No local cover available, show placeholder
            img.classList.add('error');
            if (placeholder) {
                placeholder.classList.remove('hidden');
            }
        });
    }

    // ============================================
    // Tab Navigation
    // ============================================

    function initializeTabs() {
        const tabs = document.querySelectorAll('.tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                switchTab(tabName);
            });
        });
    }

    function switchTab(tabName) {
        state.activeTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update content visibility
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-content`);
        });
    }

    // ============================================
    // Initialization
    // ============================================

    async function init() {
        // Show loading state
        const finishedContainer = document.getElementById('finished-books');
        finishedContainer.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading books...</p>
            </div>
        `;

        // Load covers map (optional - page works without it)
        try {
            const coversResponse = await fetch(CONFIG.coversMapFile);
            if (coversResponse.ok) {
                coversMap = await coversResponse.json();
            }
        } catch (e) {
            console.log('No covers.json found');
        }

        // Load and process data
        const data = await loadData();

        if (!data) {
            finishedContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>Could not load book data</p>
                    <p style="font-size: 0.875rem; margin-top: 0.5rem;">
                        Make sure BookBeat.json is in the same folder
                    </p>
                </div>
            `;
            return;
        }

        processBooks(data);
        renderStats();
        renderBooks();
        initializeTabs();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
