/* FULL timeline.js – structure preserved, adapted for Firebase (Firestore)
   Works on localhost AND on Vercel
*/

/******************** FIREBASE INIT ********************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2IslvkWwdui2qwiXdp5U1eRaNAQlKSuY",
  authDomain: "deni-erty.firebaseapp.com",
  projectId: "deni-erty",
  storageBucket: "deni-erty.firebasestorage.app",
  messagingSenderId: "61059861990",
  appId: "1:61059861990:web:6c3d502aaecbe1f40c5a27",
  measurementId: "G-TJVS4LYBF2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/******************** HELPERS ********************/
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

/******************** TIMELINE CORE ********************/
const timelineWrapper = document.querySelector('.timeline-wrapper');
const timeline = document.querySelector('.timeline');

function wireDataHandlers(el) {
  // el is the .data element
  el.addEventListener('click', () => el.classList.toggle('show'));

  const closeBtn = el.querySelector('.close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      el.classList.remove('show');
    });
  }

  // Also toggle info when clicking the dot/title
  const li = el.closest('li');
  if (li) {
    const titleEl = li.querySelector('.title');
    if (titleEl) {
      titleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        el.classList.toggle('show');
      });
    }
  }
}

function getLiTimestamp(li) {
  if (li.dataset.iso) {
    const t = new Date(li.dataset.iso + 'T00:00:00').getTime();
    if (!isNaN(t)) return t;
  }
  return Infinity;
}

function renumberDates() {
  const items = [...document.querySelectorAll('.timeline li[data-event-type="date"]')];
  items.sort((a, b) => getLiTimestamp(a) - getLiTimestamp(b));
  items.forEach((li, i) => {
    const data = li.querySelector('.data');
    if (data) data.dataset.number = i + 1;
  });
}

function addTimelineItem(event, save = false) {
  const { title, date, descriptionDeni, descriptionErty, eventType } = event;

  const li = document.createElement('li');
  li.dataset.iso = date;
  li.dataset.eventType = eventType;
  li.setAttribute('data-date', formatDate(date));

  li.innerHTML = `
    <span class="title">${escapeHtml(title)}</span>
    <div class="data ${eventType === 'skip' ? 'skip-class' : ''}">
      <h3>${escapeHtml(title)}</h3>
      <small>${formatDate(date)}</small>
      <p class="deni-comment">${escapeHtml(descriptionDeni || '')}</p>
      <p class="erty-comment">${escapeHtml(descriptionErty || '')}</p>
      <span class="close">Click to close</span>
    </div>
  `;

  const ts = new Date(date + 'T00:00:00').getTime();
  const children = [...timeline.children];
  let inserted = false;

  for (const child of children) {
    if (ts < getLiTimestamp(child)) {
      timeline.insertBefore(li, child);
      inserted = true;
      break;
    }
  }
  if (!inserted) timeline.appendChild(li);

  wireDataHandlers(li.querySelector('.data'));
  renumberDates();
}

/******************** FIRESTORE ********************/
const eventsCol = collection(db, 'events');

async function loadEventsFromFirebase() {
  const snap = await getDocs(eventsCol);
  snap.forEach(docSnap => addTimelineItem(docSnap.data()));
  renumberDates();
}

async function saveEventToFirebase(event) {
  await addDoc(eventsCol, {
    ...event,
    createdAt: serverTimestamp()
  });
}

/******************** MODAL + FORM ********************/
const showFormBtn = document.getElementById('showAddForm');
const modal = document.getElementById('addEventModal');
const closeModalBtn = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelAdd');
const addForm = document.getElementById('addEventForm');

function openModal() {
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  addForm.reset();
}

showFormBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
closeModalBtn.addEventListener('click', closeModal);

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(addForm);

  const event = {
    title: fd.get('title').trim(),
    date: fd.get('date'),
    descriptionDeni: fd.get('descriptionDeni'),
    descriptionErty: fd.get('descriptionErty'),
    eventType: fd.get('eventType')
  };

  if (!event.title || !event.date || !event.eventType) {
    alert('Missing fields');
    return;
  }

  addTimelineItem(event);
  await saveEventToFirebase(event);
  closeModal();
});

/******************** LIVE COUNTERS ********************/
(function () {
  const contractDate = new Date('2025-12-03T11:30:00');
  const turpishDate = new Date('2025-10-26T16:44:00');

  const contractEl = document.getElementById('contractCounter');
  const turpishEl = document.getElementById('turpishCounter');

  function formatTime(diff) {
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${d} days, ${h} hours, ${m} minutes`;
  }

  function update() {
    const now = new Date();
    contractEl.textContent = formatTime(now - contractDate);
    turpishEl.textContent = formatTime(now - turpishDate);
  }

  update();
  setInterval(update, 60000);
})();

/******************** INIT ********************/
loadEventsFromFirebase();

// Wire existing static timeline items
document.querySelectorAll('.timeline li .data').forEach(wireDataHandlers);
