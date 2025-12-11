// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, onSnapshot } from "firebase/firestore";


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2IslvkWwdui2qwiXdp5U1eRaNAQlKSuY",
  authDomain: "deni-erty.firebaseapp.com",
  projectId: "deni-erty",
  storageBucket: "deni-erty.firebasestorage.app",
  messagingSenderId: "61059861990",
  appId: "1:61059861990:web:6c3d502aaecbe1f40c5a27",
  measurementId: "G-TJVS4LYBF2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);


// ------------------ TIMELINE LOGIC ------------------
(function() {
    const timeline = document.querySelector('.timeline');
    const addForm = document.getElementById('addEventForm');
    const modal = document.getElementById('addEventModal');
    const showFormBtn = document.getElementById('showAddForm');
    const cancelBtn = document.getElementById('cancelAdd');
    const closeModalBtn = document.getElementById('closeModal');
    let lastFocusedElement = null;

    // --- Helpers ---
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
        if (!li.dataset.iso) return Infinity;
        const t = new Date(li.dataset.iso + 'T00:00:00').getTime();
        return isNaN(t) ? Infinity : t;
    }

    function renumberDates() {
        const allDateItems = Array.from(document.querySelectorAll('.timeline li[data-event-type="date"]'));
        allDateItems.sort((a,b) => new Date(a.dataset.iso) - new Date(b.dataset.iso));
        allDateItems.forEach((li, index) => {
            const dataEl = li.querySelector('.data');
            if (dataEl) dataEl.dataset.number = index + 1;
        });
    }

    // --- Timeline item handlers ---
    function wireDataHandlers(el) {
        el.addEventListener('click', () => el.classList.toggle('show'));
        const closeBtn = el.querySelector('.close');
        if (closeBtn) closeBtn.addEventListener('click', e => {
            e.stopPropagation();
            el.classList.remove('show');
        });
    }

    // --- Add timeline item to DOM ---
    function addTimelineItem({ title, date, descriptionDeni='', descriptionErty='', eventType='other', docId=null }) {
        const li = document.createElement('li');
        li.dataset.date = formatDate(date);
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

        // Insert in date order
        const children = Array.from(timeline.querySelectorAll('li'));
        let inserted = false;
        const newTs = new Date(date + 'T00:00:00').getTime();
        for (const child of children) {
            if (newTs < getLiTimestamp(child)) {
                timeline.insertBefore(li, child);
                inserted = true;
                break;
            }
        }
        if (!inserted) timeline.appendChild(li);

        wireDataHandlers(li.querySelector('.data'));
        renumberDates();
        li.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }

    // --- Modal open/close ---
    function openModal() {
        lastFocusedElement = document.activeElement;
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        const first = addForm.querySelector('[name="title"]');
        if (first) first.focus();
    }

    function closeModal() {
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        addForm.reset();
        if (lastFocusedElement) lastFocusedElement.focus();
    }

    showFormBtn.addEventListener('click', openModal);
    cancelBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal(); });

    // --- Form submit: add new event ---
    addForm.addEventListener('submit', async e => {
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

        try {
            // Save to Firestore
            const docRef = await addDoc(collection(db, "timelineEvents"), { title, date, descriptionDeni, descriptionErty, eventType });
            addTimelineItem({ title, date, descriptionDeni, descriptionErty, eventType, docId: docRef.id });
            closeModal();
        } catch (err) {
            console.error("Error adding event:", err);
        }
    });

    // --- Realtime updates from Firestore ---
    onSnapshot(collection(db, "timelineEvents"), snapshot => {
        timeline.innerHTML = '';
        snapshot.forEach(docSnap => {
            addTimelineItem({ ...docSnap.data(), docId: docSnap.id });
        });
        renumberDates();
    });

})();
