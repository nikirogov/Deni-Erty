<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ------------------ FIREBASE CONFIG ------------------
const firebaseConfig = {
    apiKey: "YOUR_KEY",
    authDomain: "YOUR_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// -----------------------------------------------------

(function () {
    const timelineWrapper = document.querySelector('.timeline-wrapper');
    const timeline = document.querySelector('.timeline');

    // ----------------- HELPERS -----------------
    function escapeHtml(str = '') {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateValue) {
        const d = new Date(dateValue + 'T00:00:00');
        if (isNaN(d)) return dateValue;
        const dayOfWeek = d.toLocaleDateString(undefined, { weekday: 'short' });
        const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `${dayOfWeek}, ${monthDay}`;
    }

    function getLiTimestamp(li) {
        try {
            if (li.dataset && li.dataset.iso) {
                const t = new Date(li.dataset.iso + 'T00:00:00').getTime();
                if (!isNaN(t)) return t;
            }
            const small = li.querySelector('.data small');
            if (small && small.textContent.trim()) {
                let txt = small.textContent.trim().replace(/(\d+)(st|nd|rd|th)/gi, '$1');
                const parsed = new Date(txt);
                if (!isNaN(parsed.getTime())) return parsed.getTime();
            }
        } catch (e) {}
        return Infinity;
    }

    function renumberDates() {
        const allDateItems = Array.from(document.querySelectorAll('.timeline li[data-event-type="date"]'));
        allDateItems.sort((a, b) => {
            const dateA = new Date(a.dataset.iso + 'T00:00:00').getTime();
            const dateB = new Date(b.dataset.iso + 'T00:00:00').getTime();
            return dateA - dateB;
        });
        allDateItems.forEach((li, index) => {
            const dataEl = li.querySelector('.data');
            if (dataEl) {
                dataEl.setAttribute('data-number', index + 1);
            }
        });
    }

    // ----------------- TIMELINE -----------------
    function wireDataHandlers(el) {
        el.addEventListener('click', (e) => {
            el.classList.toggle('show');
        });
        const closeBtn = el.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.classList.remove('show');
            });
        }
        const li = el.closest('li');
        if (li) {
            li.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.pageX, e.pageY, li);
            });
        }
    }

    document.querySelectorAll('.timeline li .data').forEach(wireDataHandlers);

    // --------- MODAL HANDLERS ---------
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
        setDefaultDate();
        const first = addForm.querySelector('[name="title"]');
        if (first) first.focus();
    }

    function setDefaultDate() {
        const dateInput = addForm.querySelector('[name="date"]');
        if (!dateInput) return;
        if (dateInput.value) return;
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
        const submitBtn = addForm.querySelector('button[type="submit"]');
        if (submitBtn.textContent === 'Save') submitBtn.textContent = 'Add';
        if (lastFocusedElement) lastFocusedElement.focus();
    }

    showFormBtn.addEventListener('click', openModal);
    cancelBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal(); });

    // --------- CONTEXT MENU ---------
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
        editBtn.addEventListener('click', () => { hideContextMenu(); editTimelineItem(li); });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;color:#d32f2f;';
        deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#ffebee');
        deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'none');
        deleteBtn.addEventListener('click', async () => {
            hideContextMenu();
            if (confirm('Delete this event?')) {
                if (li.dataset.docId) {
                    await deleteDoc(doc(db, "timelineEvents", li.dataset.docId));
                }
            }
        });

        contextMenu.appendChild(editBtn);
        contextMenu.appendChild(deleteBtn);
        document.body.appendChild(contextMenu);
        setTimeout(() => { document.addEventListener('click', hideContextMenu, { once: true }); }, 0);
    }

    function hideContextMenu() { if (contextMenu) { contextMenu.remove(); contextMenu = null; } }

    function editTimelineItem(li) {
        const titleSpan = li.querySelector('.title');
        const dataEl = li.querySelector('.data');
        const h3 = dataEl.querySelector('h3');
        const small = dataEl.querySelector('small');
        const pDeni = dataEl.querySelector('.deni-comment');
        const pErty = dataEl.querySelector('.erty-comment');

        const titleInput = addForm.querySelector('[name="title"]');
        const dateInput = addForm.querySelector('[name="date"]');
        const descDeniInput = addForm.querySelector('[name="descriptionDeni"]');
        const descErtyInput = addForm.querySelector('[name="descriptionErty"]');
        const eventTypeInput = addForm.querySelector('[name="eventType"]');
        const submitBtn = addForm.querySelector('button[type="submit"]');

        titleInput.value = titleSpan.textContent.trim();
        dateInput.value = li.dataset.iso || '';
        descDeniInput.value = pDeni ? pDeni.textContent.trim() : '';
        descErtyInput.value = pErty ? pErty.textContent.trim() : '';
        eventTypeInput.value = li.dataset.eventType || 'other';
        submitBtn.textContent = 'Save';
        openModal();

        function handleEditSubmit(e) {
            e.preventDefault();
            const newTitle = titleInput.value.trim();
            const newDate = dateInput.value.trim();
            const newDescDeni = descDeniInput.value.trim();
            const newDescErty = descErtyInput.value.trim();
            const newEventType = eventTypeInput.value.trim();

            titleSpan.textContent = newTitle;
            h3.textContent = newTitle;
            small.textContent = formatDate(newDate);
            if (pDeni) pDeni.textContent = newDescDeni;
            if (pErty) pErty.textContent = newDescErty;
            li.dataset.iso = newDate;
            li.dataset.eventType = newEventType;
            dataEl.className = newEventType === 'skip' ? 'data skip-class' : 'data';
            renumberDates();

            if (li.dataset.docId) {
                const docRef = doc(db, "timelineEvents", li.dataset.docId);
                updateDoc(docRef, {
                    title: newTitle,
                    date: newDate,
                    descriptionDeni: newDescDeni,
                    descriptionErty: newDescErty,
                    eventType: newEventType
                });
            }

            addForm.removeEventListener('submit', handleEditSubmit);
            submitBtn.textContent = 'Add';
            closeModal();
        }

        addForm.addEventListener('submit', handleEditSubmit);
    }

    // --------- ADD TIMELINE ITEM ---------
    function addTimelineItem({ title, date, descriptionDeni = '', descriptionErty = '', eventType = 'other', docId = null }, saveToFirebase = true) {
        const li = document.createElement('li');
        li.setAttribute('data-date', formatDate(date));
        li.dataset.iso = date;
        li.dataset.eventType = eventType;
        if (docId) li.dataset.docId = docId;

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

        const newlyAddedData = li.querySelector('.data');
        if (newlyAddedData) wireDataHandlers(newlyAddedData);

        renumberDates();

        li.scrollIntoView({ behavior: 'smooth', inline: 'center' });

        if (saveToFirebase && !docId) {
            (async () => {
                const docRef = await addDoc(collection(db, "timelineEvents"), { title, date, descriptionDeni, descriptionErty, eventType });
                li.dataset.docId = docRef.id;
            })();
        }
    }

    // --------- FORM SUBMIT ---------
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(addForm);
        const title = (formData.get('title') || '').trim();
        const date = (formData.get('date') || '').trim();
        const descriptionDeni = (formData.get('descriptionDeni') || '').trim();
        const descriptionErty = (formData.get('descriptionErty') || '').trim();
        const eventType = (formData.get('eventType') || '').trim();

        if (!title || !date || !eventType) {
            alert('Please provide a title, date, and event type.');
            return;
        }

        addTimelineItem({ title, date, descriptionDeni, descriptionErty, eventType });
        addForm.reset();
        closeModal();
    });

    // --------- REALTIME FIREBASE UPDATES ---------
    const timelineCol = collection(db, "timelineEvents");
    onSnapshot(timelineCol, snapshot => {
        timeline.innerHTML = "";
        snapshot.forEach(docSnap => {
            addTimelineItem({ ...docSnap.data(), docId: docSnap.id }, false);
        });
        renumberDates();
    });

})();
