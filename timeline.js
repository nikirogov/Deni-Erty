/******************** FIREBASE INIT ********************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from './firebase-config.js';
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

// Context menu variable - holds reference to the currently open menu
let contextMenu = null;

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

  // RIGHT-CLICK CONTEXT MENU
  // This listens for right-clicks on the timeline item
  li.addEventListener('contextmenu', e => {
    e.preventDefault(); // Prevents the browser's default right-click menu
    showContextMenu(e.clientX, e.clientY, li); // Show our custom menu at mouse position
  });
}

// SHOW CONTEXT MENU
// This function creates and displays the right-click menu
function showContextMenu(x, y, li) {
  hideContextMenu(); // First, close any existing menu
  
  // Create the menu container (a div element)
  contextMenu = document.createElement('div');
  contextMenu.style.cssText = 'position:fixed;background:#fff;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10000;padding:0.3rem 0;';
  contextMenu.style.left = x + 'px'; // Position at mouse X
  contextMenu.style.top = y + 'px';  // Position at mouse Y

  // Create "Edit" button
  const editBtn = document.createElement('button');
  editBtn.textContent = 'Edit';
  editBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;';
  
  // Hover effects for Edit button
  editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#f0f0f0');
  editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'none');
  
  // When Edit is clicked, close menu and open edit mode
  editBtn.addEventListener('click', () => {
    hideContextMenu();
    editTimelineItem(li);
  });

  // Create "Delete" button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;color:#d32f2f;';
  
  // Hover effects for Delete button
  deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#ffebee');
  deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'none');
  
  // When Delete is clicked, confirm and remove the event
  deleteBtn.addEventListener('click', async () => {
    hideContextMenu();
    if (confirm('Delete this event?')) {
      const docId = li.dataset.docId;
      if (docId) await deleteDoc(doc(db, 'events', docId));
      li.remove();
      renumberDates();
      
      // Update calendar after deletion
      if (window.updateCalendar) window.updateCalendar();
    }
  });

  // Add both buttons to the menu
  contextMenu.appendChild(editBtn);
  contextMenu.appendChild(deleteBtn);
  document.body.appendChild(contextMenu); // Add menu to the page

  // Close menu when clicking anywhere outside
  // setTimeout ensures this listener is added AFTER the current click finishes
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 0);
}

// HIDE CONTEXT MENU
// Removes the context menu from the page
function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove(); // Remove the menu element
    contextMenu = null;   // Clear the reference
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
  
  // Update calendar to reflect new event
  if (window.updateCalendar) window.updateCalendar();
}

/******************** FIRESTORE ********************/
const eventsCol = collection(db, 'events');

async function loadEventsFromFirebase() {
  const snap = await getDocs(eventsCol);
  snap.forEach(docSnap => addTimelineItem(docSnap.data(), docSnap.id));
  renumberDates();
  
  // Update calendar after loading all events
  if (window.updateCalendar) window.updateCalendar();
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

// Variable to track if we're in edit mode
let editingLi = null;

function openModal() {
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  addForm.reset();
  editingLi = null; // Clear edit mode
  
  // Reset button text back to "Add"
  const submitBtn = addForm.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Add';
}

showFormBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
closeModalBtn.addEventListener('click', closeModal);

// EDIT TIMELINE ITEM FUNCTION
// This function opens the form modal with existing event data for editing
function editTimelineItem(li) {
  const dataEl = li.querySelector('.data');
  const titleSpan = li.querySelector('.title');
  const h3 = dataEl.querySelector('h3');
  const deniP = dataEl.querySelector('.deni-comment');
  const ertyP = dataEl.querySelector('.erty-comment');

  // Extract current values from the timeline item
  const currentTitle = titleSpan.textContent.trim();
  const currentDescDeni = deniP ? deniP.textContent.trim() : '';
  const currentDescErty = ertyP ? ertyP.textContent.trim() : '';
  const currentEventType = li.dataset.eventType || 'other';
  const currentSpecialEvent = li.classList.contains('special-event');

  // Get form inputs
  const titleInput = addForm.querySelector('[name="title"]');
  const dateInput = addForm.querySelector('[name="date"]');
  const descDeniInput = addForm.querySelector('[name="descriptionDeni"]');
  const descErtyInput = addForm.querySelector('[name="descriptionErty"]');
  const eventTypeInput = addForm.querySelector('[name="eventType"]');
  const specialEventInput = addForm.querySelector('[name="specialEvent"]');
  const submitBtn = addForm.querySelector('button[type="submit"]');

  // Pre-fill the form with current values
  titleInput.value = currentTitle;
  
  // Use the stored ISO date if available
  if (li.dataset.iso) {
    dateInput.value = li.dataset.iso;
  }
  
  descDeniInput.value = currentDescDeni;
  descErtyInput.value = currentDescErty;
  eventTypeInput.value = currentEventType;
  specialEventInput.checked = currentSpecialEvent;

  // Change button text to indicate edit mode
  submitBtn.textContent = 'Save Changes';

  // Store reference to the item being edited
  editingLi = li;

  // Open the modal
  openModal();
}

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

  // CHECK IF WE'RE EDITING OR ADDING
  if (editingLi) {
    // EDIT MODE: Update existing event
    const docId = editingLi.dataset.docId;
    
    // Update in Firebase
    if (docId) {
      await updateDoc(doc(db, 'events', docId), event);
    }
    
    // Update the DOM element
    const dataEl = editingLi.querySelector('.data');
    const titleSpan = editingLi.querySelector('.title');
    const h3 = dataEl.querySelector('h3');
    const small = dataEl.querySelector('small');
    const deniP = dataEl.querySelector('.deni-comment');
    const ertyP = dataEl.querySelector('.erty-comment');

    // Update text content
    titleSpan.textContent = event.title;
    h3.textContent = event.title;
    small.textContent = formatDate(event.date);
    if (deniP) deniP.textContent = event.descriptionDeni || '';
    if (ertyP) ertyP.textContent = event.descriptionErty || '';

    // Update data attributes
    editingLi.setAttribute('data-date', formatDate(event.date));
    editingLi.dataset.iso = event.date;
    editingLi.dataset.eventType = event.eventType;

    // Update class based on event type
    dataEl.className = event.eventType === 'skip' ? 'data skip-class' : 'data';
    
    // Update special event styling
    if (event.specialEvent) {
      editingLi.classList.add('special-event');
    } else {
      editingLi.classList.remove('special-event');
    }

    // Handle image update if provided
    if (imgData) {
      let img = dataEl.querySelector('.event-image');
      if (img) {
        img.src = imgData;
      } else {
        // Insert new image before h3
        img = document.createElement('img');
        img.src = imgData;
        img.alt = 'Event image';
        img.className = 'event-image';
        dataEl.insertBefore(img, h3);
      }
    }

    // Re-sort timeline items by date
    renumberDates();
    
    // Update calendar after editing
    if (window.updateCalendar) window.updateCalendar();
    
  } else {
    // ADD MODE: Create new event
    const docId = await saveEventToFirebase(event);
    addTimelineItem(event, docId);
  }

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

/******************** CALENDAR NAVIGATION ********************/
(function() {
  // Calendar state - tracks which month we're currently viewing
  let currentDate = new Date();
  
  // Get DOM elements
  const habitTitle = document.getElementById('habitTitle');
  const totalDays = document.getElementById('totalDays');
  const tracker = document.getElementById('tracker');
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');

  // Month names for display
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * RENDER CALENDAR
   * This function generates the calendar grid for the current month
   * It creates divs for each day and marks special dates
   */
  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update the title to show current month and year
    habitTitle.textContent = `${monthNames[month]} ${year}`;
    
    // Calculate calendar details
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // getDay() returns 0-6 (Sun-Sat), we want Mon=0, so adjust
    let firstDayOfWeek = firstDay.getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6; // Sunday becomes 6
    
    // Clear existing calendar
    tracker.innerHTML = '';
    
    // Count events for this month
    let eventCount = 0;
    
    // Create calendar grid
    let dayCounter = 1;
    let totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
    
    for (let i = 0; i < totalCells; i++) {
      const dayDiv = document.createElement('div');
      dayDiv.classList.add('day');
      
      // Empty cells before month starts
      if (i < firstDayOfWeek) {
        dayDiv.classList.add('empty');
        tracker.appendChild(dayDiv);
        continue;
      }
      
      // Days of the month
      if (dayCounter <= daysInMonth) {
        dayDiv.textContent = dayCounter;
        dayDiv.dataset.day = dayCounter;
        
        // Check if this date has an event
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;
        if (hasEventOnDate(dateStr)) {
          dayDiv.classList.add('has-event');
          eventCount++;
        }
        
        // Highlight today
        const today = new Date();
        if (year === today.getFullYear() && 
            month === today.getMonth() && 
            dayCounter === today.getDate()) {
          dayDiv.classList.add('today');
        }
        
        dayCounter++;
      } else {
        // Empty cells after month ends
        dayDiv.classList.add('empty');
      }
      
      tracker.appendChild(dayDiv);
    }
    
    // Update total days counter
    totalDays.textContent = `${eventCount}/${daysInMonth}`;
  }

  /**
   * CHECK IF DATE HAS EVENT
   * Looks through timeline items to see if any match the given date
   */
  function hasEventOnDate(dateStr) {
    const timelineItems = document.querySelectorAll('.timeline li[data-iso]');
    
    // Debug: Log the first time to see what dates we have
    if (window.calendarDebugOnce !== true) {
      console.log('📅 Calendar Debug: Checking events');
      console.log('Total timeline items with dates:', timelineItems.length);
      if (timelineItems.length > 0) {
        console.log('Sample dates:', Array.from(timelineItems).slice(0, 3).map(item => item.dataset.iso));
      }
      window.calendarDebugOnce = true;
    }
    
    for (const item of timelineItems) {
      if (item.dataset.iso === dateStr) {
        return true;
      }
    }
    return false;
  }

  /**
   * NAVIGATION FUNCTIONS
   * Move backward/forward through months
   */
  function goToPreviousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  }

  function goToNextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  }

  // Add event listeners to navigation buttons
  prevBtn.addEventListener('click', goToPreviousMonth);
  nextBtn.addEventListener('click', goToNextMonth);

  // Allow keyboard navigation
  prevBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToPreviousMonth();
    }
  });

  nextBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToNextMonth();
    }
  });

  // Initial render
  renderCalendar();

  // Re-render calendar when events change
  // We'll call this after adding/editing/deleting events
  window.updateCalendar = renderCalendar;
})();
