(function () {
    const timelineWrapper = document.querySelector('.timeline-wrapper');
    const timeline = document.querySelector('.timeline');

    // helper: escape HTML to avoid injection
    function escapeHtml(str = '') {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // helper: pretty-format a yyyy-mm-dd to locale date string (without year)
    function formatDate(dateValue) {
        const d = new Date(dateValue + 'T00:00:00');
        if (isNaN(d)) return dateValue;
        const dayOfWeek = d.toLocaleDateString(undefined, { weekday: 'short' });
        const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `${dayOfWeek}, ${monthDay}`;
    }

    // LocalStorage functions for timeline events
    function saveEventsToStorage() {
        const events = [];
        timeline.querySelectorAll('li').forEach(li => {
            if (li.dataset.iso) { // only save dynamically added items with iso date
                const titleSpan = li.querySelector('.title');
                const deniP = li.querySelector('.deni-comment');
                const ertyP = li.querySelector('.erty-comment');

                events.push({
                    title: titleSpan.textContent.trim(),
                    date: li.dataset.iso,
                    descriptionDeni: deniP ? deniP.textContent.trim() : '',
                    descriptionErty: ertyP ? ertyP.textContent.trim() : '',
                    eventType: li.dataset.eventType || 'other'
                });
            }
        });
        localStorage.setItem('timelineEvents', JSON.stringify(events));
    }

    function loadEventsFromStorage() {
        const stored = localStorage.getItem('timelineEvents');
        if (stored) {
            try {
                const events = JSON.parse(stored);
                events.forEach(event => addTimelineItem(event, false)); // false = don't save again
            } catch (e) {
                console.error('Failed to load events from storage:', e);
            }
        }
    }

    function wireDataHandlers(el) {
        // el is the .data element
        el.addEventListener('click', (e) => {
            // if clicking the inner close button, the close handler will be run
            el.classList.toggle('show');
        });

        const closeBtn = el.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.classList.remove('show');
            });
        }

        // right-click context menu for edit/delete
        const li = el.closest('li');
        if (li) {
            li.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.pageX, e.pageY, li);
            });
        }
    }

    // wire handlers for existing .data items
    document.querySelectorAll('.timeline li .data').forEach(wireDataHandlers);

    // form UI (modal)
    const showFormBtn = document.getElementById('showAddForm');
    const addForm = document.getElementById('addEventForm');
    const cancelBtn = document.getElementById('cancelAdd');
    const modal = document.getElementById('addEventModal');
    const closeModalBtn = document.getElementById('closeModal');
    let lastFocusedElement = null;

    function openModal() {
        lastFocusedElement = document.activeElement;
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        // set default date and focus first field
        setDefaultDate();
        const first = addForm.querySelector('[name="title"]');
        if (first) first.focus();
    }

    // set date input default to today (yyyy-mm-dd)
    function setDefaultDate() {
        const dateInput = addForm.querySelector('[name="date"]');
        if (!dateInput) return;
        if (dateInput.value) return; // don't override if already set
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    function closeModal() {
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        addForm.reset();
        
        // Restore button text if it was changed to "Save"
        const submitBtn = addForm.querySelector('button[type="submit"]');
        if (submitBtn.textContent === 'Save') {
            submitBtn.textContent = 'Add';
        }
        
        if (lastFocusedElement) lastFocusedElement.focus();
    }

    showFormBtn.addEventListener('click', openModal);
    cancelBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    // close when clicking backdrop (outside dialog)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
    });

    // Renumber all romantic dates
    function renumberDates() {
        const allDateItems = Array.from(document.querySelectorAll('.timeline li[data-event-type="date"]'));
        // Sort by date
        allDateItems.sort((a, b) => {
            const dateA = new Date(a.dataset.iso + 'T00:00:00').getTime();
            const dateB = new Date(b.dataset.iso + 'T00:00:00').getTime();
            return dateA - dateB;
        });
        
        // Renumber them
        allDateItems.forEach((li, index) => {
            const dataEl = li.querySelector('.data');
            if (dataEl) {
                dataEl.setAttribute('data-number', index + 1);
            }
        });
    }

    // add item function
    function addTimelineItem({ title, date, descriptionDeni = '', descriptionErty = '', eventType = 'other' }, saveToStorage = true) {
        const li = document.createElement('li');
        // store human-friendly date and an ISO date on the element for sorting
        li.setAttribute('data-date', formatDate(date));
        li.dataset.iso = date; // yyyy-mm-dd from the form, used for chronological sorting
        li.dataset.eventType = eventType;

        const dataClass = eventType === 'skip' ? 'data skip-class' : 'data';

        li.innerHTML = `
            <span class="title">${escapeHtml(title)}</span>
            <div class="${dataClass}">
                <h3>${escapeHtml(title)}</h3>
                <small>${escapeHtml(formatDate(date))}</small>
                <p class="deni-comment">${escapeHtml(descriptionDeni)}</p>
                <p class="erty-comment">${escapeHtml(descriptionErty)}</p>
                <span class="close">Click to close</span>
            </div>
        `;

        // insert new item in chronological order (by iso date)
        const newTs = (new Date(date + 'T00:00:00')).getTime();
        const children = Array.from(timeline.querySelectorAll('li'));
        let inserted = false;
        for (const child of children) {
            const childTs = getLiTimestamp(child);
            if (isFinite(childTs) && newTs < childTs) {
                timeline.insertBefore(li, child);
                inserted = true;
                break;
            }
        }
        if (!inserted) timeline.appendChild(li);

        // wire the new data element for show/hide
        const newlyAddedData = li.querySelector('.data');
        if (newlyAddedData) wireDataHandlers(newlyAddedData);

        // Renumber all romantic dates
        renumberDates();

        // scroll newly added item into view (center)
        li.scrollIntoView({ behavior: 'smooth', inline: 'center' });

        // save to localStorage
        if (saveToStorage) saveEventsToStorage();
    }

    // Return a numeric timestamp for a li element's date, or Infinity if unknown
    function getLiTimestamp(li) {
        try {
            if (li.dataset && li.dataset.iso) {
                const t = new Date(li.dataset.iso + 'T00:00:00').getTime();
                if (!isNaN(t)) return t;
            }
            // try to read the small tag inside .data (e.g. "12th December 2023")
            const small = li.querySelector('.data small');
            if (small && small.textContent.trim()) {
                // normalize ordinals (1st, 2nd, 3rd, 4th -> 1,2,3,4)
                let txt = small.textContent.trim().replace(/(\d+)(st|nd|rd|th)/gi, '$1');
                const parsed = new Date(txt);
                if (!isNaN(parsed.getTime())) return parsed.getTime();
            }
        } catch (e) {
            // fallthrough
        }
        return Infinity;
    }

    // handle form submit
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(addForm);
        const title = (formData.get('title') || '').toString().trim();
        const date = (formData.get('date') || '').toString().trim();
        const descriptionDeni = (formData.get('descriptionDeni') || '').toString().trim();
        const descriptionErty = (formData.get('descriptionErty') || '').toString().trim();
        const eventType = (formData.get('eventType') || '').toString().trim();

        if (!title || !date || !eventType) {
            alert('Please provide a title, date, and event type.');
            return;
        }

        addTimelineItem({ title, date, descriptionDeni, descriptionErty, eventType });

        // reset and close modal after adding
        addForm.reset();
        closeModal();
    });

    // Optional: enable dragging to scroll horizontally on desktop
    let isDown = false, startX, scrollLeft;
    timelineWrapper.addEventListener('mousedown', (e) => {
        isDown = true;
        timelineWrapper.classList.add('dragging');
        startX = e.pageX - timelineWrapper.offsetLeft;
        scrollLeft = timelineWrapper.scrollLeft;
    });
    timelineWrapper.addEventListener('mouseleave', () => { isDown = false; timelineWrapper.classList.remove('dragging');});
    timelineWrapper.addEventListener('mouseup', () => { isDown = false; timelineWrapper.classList.remove('dragging');});
    timelineWrapper.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - timelineWrapper.offsetLeft;
        const walk = (x - startX) * 1.5;
        timelineWrapper.scrollLeft = scrollLeft - walk;
    });

    // Context menu for edit/delete
    let contextMenu = null;

    function showContextMenu(x, y, li) {
        hideContextMenu();
        contextMenu = document.createElement('div');
        contextMenu.style.cssText = 'position:fixed;background:#fff;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10000;padding:0.3rem 0;';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;';
        editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#f0f0f0');
        editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'none');
        editBtn.addEventListener('click', () => {
            hideContextMenu();
            editTimelineItem(li);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;color:#d32f2f;';
        deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#ffebee');
        deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'none');
        deleteBtn.addEventListener('click', () => {
            hideContextMenu();
            if (confirm('Delete this event?')) {
                li.remove();
                saveEventsToStorage();
            }
        });

        contextMenu.appendChild(editBtn);
        contextMenu.appendChild(deleteBtn);
        document.body.appendChild(contextMenu);

        // close on click outside
        setTimeout(() => {
            document.addEventListener('click', hideContextMenu, { once: true });
        }, 0);
    }

    function hideContextMenu() {
        if (contextMenu) {
            contextMenu.remove();
            contextMenu = null;
        }
    }

    function editTimelineItem(li) {
        const dataEl = li.querySelector('.data');
        const titleSpan = li.querySelector('.title');
        const h3 = dataEl.querySelector('h3');
        const small = dataEl.querySelector('small');
        const p = dataEl.querySelector('p');

        const currentTitle = titleSpan.textContent.trim();
        const currentDesc = p.textContent.trim();
        const currentEventType = li.dataset.eventType || 'other';

        // open modal with current values
        const titleInput = addForm.querySelector('[name="title"]');
        const dateInput = addForm.querySelector('[name="date"]');
        const descDeniInput = addForm.querySelector('[name="descriptionDeni"]');
        const descErtyInput = addForm.querySelector('[name="descriptionErty"]');
        const eventTypeInput = addForm.querySelector('[name="eventType"]');
        const submitBtn = addForm.querySelector('button[type="submit"]');

        titleInput.value = currentTitle;
        // Use the stored ISO date if available, otherwise parse from data-date
        if (li.dataset.iso) {
            dateInput.value = li.dataset.iso;
        } else {
            const currentDate = li.getAttribute('data-date');
            const parsedDate = new Date(currentDate);
            if (!isNaN(parsedDate)) {
                const yyyy = parsedDate.getFullYear();
                const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const dd = String(parsedDate.getDate()).padStart(2, '0');
                dateInput.value = `${yyyy}-${mm}-${dd}`;
            }
        }
        descInput.value = currentDesc;
        eventTypeInput.value = currentEventType;

        // Change button text to "Save"
        submitBtn.textContent = 'Save';

        openModal();

        // Create a one-time handler for this edit
        function handleEditSubmit(e) {
            e.preventDefault();
            const newTitle = titleInput.value.trim();
            const newDate = dateInput.value.trim();
            const newDesc = descInput.value.trim();
            const newEventType = eventTypeInput.value.trim();

            if (!newTitle || !newDate || !newEventType) {
                alert('Please provide a title, date, and event type.');
                return;
            }

            // update the item in place
            titleSpan.textContent = newTitle;
            h3.textContent = newTitle;
            small.textContent = formatDate(newDate);
            p.textContent = newDesc;
            li.setAttribute('data-date', formatDate(newDate));
            li.dataset.iso = newDate;
            li.dataset.eventType = newEventType;
            
            // Update class based on event type
            dataEl.className = newEventType === 'skip' ? 'data skip-class' : 'data';
            
            // Renumber dates
            renumberDates();

            saveEventsToStorage();

            // Remove this edit handler and restore normal behavior
            addForm.removeEventListener('submit', handleEditSubmit);
            submitBtn.textContent = 'Add';
            
            closeModal();
        }

        // Remove the default add handler temporarily and add edit handler
        addForm.addEventListener('submit', handleEditSubmit);
    }

    // Load events from localStorage on page load
    loadEventsFromStorage();
    
    // Renumber dates after loading from storage
    renumberDates();
})();


// Add this at the end of timeline.js (after the IIFE closing)

// Live counters
(function() {
    const contractDate = new Date('2025-12-03T11:30:00'); // Dec 3, 2024, 12:00 PM
    const turpishDate = new Date('2025-10-26T16:44:00');  // Oct 26, 2024, 4:44 PM
    
    const contractEl = document.getElementById('contractCounter');
    const turpishEl = document.getElementById('turpishCounter');
    
    function formatTime(diff) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        let parts = [];
        if (days > 0) parts.push(`${days} days`);
        if (hours > 0) parts.push(`${hours} hours`);
        if (minutes > 0) parts.push(`${minutes} minutes`);
        
        return parts.length > 0 ? parts.join(', ') : '0 minutes';
    }
    
    function updateCounters() {
        const now = new Date();
        
        // Contract counter
        const contractDiff = now - contractDate;
        contractEl.textContent = formatTime(contractDiff);
        
        // Turpish counter
        const turpishDiff = now - turpishDate;
        turpishEl.textContent = formatTime(turpishDiff);
    }
    
    // Update immediately and then every minute
    updateCounters();
    setInterval(updateCounters, 60000); // 60000ms = 1 minute
})();

// Quotes functionality
(function() {
    const showQuoteBtn = document.getElementById('showAddQuote');
    const quoteForm = document.getElementById('addQuoteForm');
    const cancelQuoteBtn = document.getElementById('cancelAddQuote');
    const quoteModal = document.getElementById('addQuoteModal');
    const closeQuoteModalBtn = document.getElementById('closeQuoteModal');
    const quotesList = document.getElementById('quotesList');
    let lastFocusedElement = null;

    function escapeHtml(str = '') {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // LocalStorage functions for quotes
    function saveQuotesToStorage() {
        const quotes = [];
        quotesList.querySelectorAll('.quote-item').forEach(li => {
            const quoteText = li.querySelector('.quote-text').textContent.replace(/^"|"$/g, '').trim();
            const authorText = li.querySelector('.quote-author').textContent.replace(/^— /, '').trim();
            const person = li.classList.contains('deni') ? 'deni' : li.classList.contains('erty') ? 'erty' : 'other';
            quotes.push({
                quote: quoteText,
                person: person,
                personName: person === 'other' ? authorText : ''
            });
        });
        localStorage.setItem('quotes', JSON.stringify(quotes));
    }

    function loadQuotesFromStorage() {
        const stored = localStorage.getItem('quotes');
        if (stored) {
            try {
                const quotes = JSON.parse(stored);
                quotes.forEach(quote => addQuote(quote, false)); // false = don't save again
            } catch (e) {
                console.error('Failed to load quotes from storage:', e);
            }
        }
    }

    function openQuoteModal() {
        lastFocusedElement = document.activeElement;
        quoteModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        const first = quoteForm.querySelector('[name="quote"]');
        if (first) first.focus();
    }

    function closeQuoteModal() {
        quoteModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        quoteForm.reset();
        if (lastFocusedElement) lastFocusedElement.focus();
    }

    showQuoteBtn.addEventListener('click', openQuoteModal);
    cancelQuoteBtn.addEventListener('click', closeQuoteModal);
    closeQuoteModalBtn.addEventListener('click', closeQuoteModal);

    // Toggle name input visibility based on person selection
    const personSelect = document.getElementById('personSelect');
    const personNameInput = document.getElementById('personNameInput');
    
    personSelect.addEventListener('change', (e) => {
        if (e.target.value === 'other') {
            personNameInput.style.display = 'block';
            personNameInput.required = true;
        } else {
            personNameInput.style.display = 'none';
            personNameInput.required = false;
            personNameInput.value = '';
        }
    });

    quoteModal.addEventListener('click', (e) => {
        if (e.target === quoteModal) closeQuoteModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && quoteModal.getAttribute('aria-hidden') === 'false') closeQuoteModal();
    });

    function addQuote({ quote, person, personName }, saveToStorage = true) {
        const li = document.createElement('li');
        li.className = 'quote-item';
        
        // Add color class based on person
        if (person === 'deni' || person === 'erty') {
            li.classList.add(person);
        }

        const authorName = person === 'other' ? personName : person.charAt(0).toUpperCase() + person.slice(1);

        li.innerHTML = `
            <p class="quote-text">"${escapeHtml(quote)}"</p>
            <p class="quote-author">${escapeHtml(authorName)}</p>
            <button class="delete-quote" aria-label="Delete quote">✕</button>
        `;

        const deleteBtn = li.querySelector('.delete-quote');
        deleteBtn.addEventListener('click', () => {
            if (confirm('Delete this quote?')) {
                li.remove();
                saveQuotesToStorage();
            }
        });

        quotesList.appendChild(li);

        if (saveToStorage) saveQuotesToStorage();
    }

    quoteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(quoteForm);
        const quote = (formData.get('quote') || '').toString().trim();
        const person = (formData.get('person') || '').toString().trim();
        const personName = (formData.get('personName') || '').toString().trim();

        if (!quote || !person) {
            alert('Please provide both a quote and select a person.');
            return;
        }

        if (person === 'other' && !personName) {
            alert('Please provide a name for "Other".');
            return;
        }

        addQuote({ quote, person, personName });

        quoteForm.reset();
        closeQuoteModal();
    });

    // Load quotes from localStorage on page load
    loadQuotesFromStorage();
})();

// Calendar functionality
(function() {
    const habitTitle = document.getElementById('habitTitle');
    const totalDaysEl = document.getElementById('totalDays');
    const streakCounterEl = document.getElementById('streakCounter');
    const dayElements = document.querySelectorAll('.day');
    
    function calculateStreak() {
        // Get all timeline dates and sort them
        const timelineItems = document.querySelectorAll('.timeline li');
        const allDates = [];
        
        timelineItems.forEach(li => {
            const dateStr = li.dataset.iso || li.getAttribute('data-date');
            if (dateStr) {
                const itemDate = new Date(dateStr + 'T00:00:00');
                if (!isNaN(itemDate)) {
                    allDates.push(itemDate);
                }
            }
        });
        
        if (allDates.length === 0) return 0;
        
        // Sort dates in descending order (most recent first)
        allDates.sort((a, b) => b - a);
        
        // Normalize dates to midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Check if streak is still active (today or yesterday)
        const mostRecent = new Date(allDates[0]);
        mostRecent.setHours(0, 0, 0, 0);
        
        if (mostRecent.getTime() !== today.getTime() && mostRecent.getTime() !== yesterday.getTime()) {
            return 0; // Streak broken
        }
        
        // Count consecutive days
        let streak = 1;
        let currentDate = new Date(mostRecent);
        
        for (let i = 1; i < allDates.length; i++) {
            const checkDate = new Date(allDates[i]);
            checkDate.setHours(0, 0, 0, 0);
            
            const expectedDate = new Date(currentDate);
            expectedDate.setDate(expectedDate.getDate() - 1);
            
            if (checkDate.getTime() === expectedDate.getTime()) {
                streak++;
                currentDate = checkDate;
            } else {
                break; // Streak broken
            }
        }
        
        return streak;
    }
    
    function updateCalendar() {
        // Set current month name
        const now = new Date();
        const monthName = now.toLocaleDateString('en-US', { month: 'long' });
        habitTitle.textContent = monthName;
        
        // Get all timeline dates from current month
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const activeDays = new Set();
        
        // Check timeline items
        const timelineItems = document.querySelectorAll('.timeline li');
        timelineItems.forEach(li => {
            const dateStr = li.dataset.iso || li.getAttribute('data-date');
            if (dateStr) {
                const itemDate = new Date(dateStr + 'T00:00:00');
                if (!isNaN(itemDate) && itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear) {
                    activeDays.add(itemDate.getDate());
                }
            }
        });
        
        // Update day elements
        dayElements.forEach(dayEl => {
            const dayNum = parseInt(dayEl.textContent);
            if (activeDays.has(dayNum)) {
                dayEl.classList.add('active');
            } else {
                dayEl.classList.remove('active');
            }
        });
        
        // Update total count
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        totalDaysEl.textContent = `${activeDays.size}/${daysInMonth}`;
        
        // Update streak counter
        const streak = calculateStreak();
        streakCounterEl.textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
    }
    
    // Update calendar on page load
    updateCalendar();
    
    // Re-update calendar when timeline changes (using MutationObserver)
    if (timeline) {
        const observer = new MutationObserver(updateCalendar);
        observer.observe(timeline, { childList: true, subtree: true });
    }
})();