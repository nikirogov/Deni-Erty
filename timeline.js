/******************** FIREBASE INIT ********************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
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
  const li = el.closest('li');

  el.addEventListener('click', () => el.classList.toggle('show'));

  const closeBtn = el.querySelector('.close');
  if (closeBtn) closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    el.classList.remove('show');
  });

  const deleteBtn = el.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async e => {
      e.stopPropagation();
      if (confirm('Delete this event?')) {
        const docId = li.dataset.docId;
        if (docId) await deleteDoc(doc(db, 'events', docId));
        li.remove();
        renumberDates();
      }
    });
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

async function addTimelineItem(event, docId = null) {
  const { title, date, descriptionDeni, descriptionErty, eventType, specialEvent, image } = event;

  const li = document.createElement('li');
  li.dataset.iso = date;
  li.dataset.eventType = eventType;
  li.setAttribute('data-date', formatDate(date));
  if (docId) li.dataset.docId = docId;
  if (specialEvent) li.classList.add('special-event');

  li.innerHTML = `
    <span class="title">${escapeHtml(title)}</span>
    <div class="data ${eventType === 'skip' ? 'skip-class' : ''}">
      ${image ? `<img src="${image}" alt="Event image" class="event-image">` : ''}
      <h3>${escapeHtml(title)}</h3>
      <small>${formatDate(date)}</small>
      <p class="deni-comment">${escapeHtml(descriptionDeni || '')}</p>
      <p class="erty-comment">${escapeHtml(descriptionErty || '')}</p>
      <span class="close">Click to close</span>
      <button class="delete-btn">Delete</button>
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
  snap.forEach(docSnap => addTimelineItem(docSnap.data(), docSnap.id));
  renumberDates();
}

async function saveEventToFirebase(event) {
  const docRef = await addDoc(eventsCol, {
    ...event,
    createdAt: serverTimestamp()
  });
  return docRef.id;
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

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(addForm);

  // Handle optional image upload
  const file = fd.get('eventImage');
  let imgData = null;
  if (file && file.size > 0) {
    imgData = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  const event = {
    title: fd.get('title').trim(),
    date: fd.get('date'),
    descriptionDeni: fd.get('descriptionDeni'),
    descriptionErty: fd.get('descriptionErty'),
    eventType: fd.get('eventType'),
    specialEvent: fd.get('specialEvent') === 'on',
    image: imgData // <-- optional image
  };

  if (!event.title || !event.date || !event.eventType) {
    alert('Missing fields');
    return;
  }

  const docId = await saveEventToFirebase(event);
  addTimelineItem(event, docId);
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
document.querySelectorAll('.timeline li .data').forEach(wireDataHandlers);
