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
  getDoc,
  setDoc,
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

function colorizeNames(text) {
  if (!text) return '';
  // Replace "deni" with purple color and "erty" with blue color (case-insensitive)
  return text
    .replace(/\bdeni\b/gi, '<span style="color: #ba9aed; font-weight: 600;">deni</span>')
    .replace(/\berty\b/gi, '<span style="color: #6db3f2; font-weight: 600;">erty</span>');
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
      
      // Update calendar and statistics after deletion
      if (window.updateCalendar) window.updateCalendar();
      if (window.renderStatistics) window.renderStatistics();
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
  if (eventType === 'online') li.dataset.online = 'true';

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
  
  // Update calendar and statistics to reflect new event
  if (window.updateCalendar) window.updateCalendar();
  if (window.renderStatistics) window.renderStatistics();
}

/******************** FIRESTORE ********************/
const eventsCol = collection(db, 'events');

async function loadEventsFromFirebase() {
  const snap = await getDocs(eventsCol);
  snap.forEach(docSnap => addTimelineItem(docSnap.data(), docSnap.id));
  renumberDates();
  
  // Update calendar and statistics after loading all events
  if (window.updateCalendar) window.updateCalendar();
  if (window.renderStatistics) window.renderStatistics();
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
  const currentSpecialEvent = li.classList.contains('special-event');  // Get form inputs
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
    if (event.eventType === 'online') {
      editingLi.dataset.online = 'true';
    } else {
      delete editingLi.dataset.online;
    }

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
    
    // Update calendar and statistics after editing
    if (window.updateCalendar) window.updateCalendar();
    if (window.renderStatistics) window.renderStatistics();
    
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

/******************** RELATIONSHIP STATISTICS ********************/
(function() {
  function calculateStatistics() {
    const timelineItems = document.querySelectorAll('.timeline li[data-iso]');
    
    // Total dates (excluding online dates)
    const totalDates = Array.from(timelineItems).filter(item => !item.dataset.online).length;
    
    // Location breakdown - categorize by type
    let atHomeCount = 0;  // U Deni + U Erty
    let goingOutCount = 0; // Dates, other places
    let uDeniCount = 0;
    let uErtyCount = 0;
    
    // Date tracking
    const dates = [];
    const monthCounts = {};
    
    // Debug: Log first 5 items to see what we're working with
    console.log('📊 Statistics Debug:');
    console.log('Total items:', timelineItems.length);
    
    timelineItems.forEach((item, index) => {
      const eventType = item.dataset.eventType;
      const dateStr = item.dataset.iso;
      const title = item.querySelector('.title')?.textContent.toLowerCase() || '';
      const isOnline = item.dataset.online === 'true';
      
      // Debug first 5 items
      if (index < 5) {
        console.log(`Item ${index + 1}:`, { title, eventType });
      }
      
      // Skip online dates from statistics
      if (isOnline) {
        return;
      }
      
      // Count locations - prioritize eventType, then check title as fallback
      if (eventType === 'udeni') {
        uDeniCount++;
        atHomeCount++;
      } else if (eventType === 'uerty') {
        uErtyCount++;
        atHomeCount++;
      } else if (eventType === 'home') {
        // Old "home" events - check title to determine location
        if (title.includes('erty')) {
          uErtyCount++;
        } else {
          uDeniCount++;
        }
        atHomeCount++;
      } else {
        // For everything else (date, skip, other)
        goingOutCount++;
      }
      
      // Track dates
      if (dateStr) {
        dates.push(new Date(dateStr));
        
        // Count by month
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
      }
    });
    
    console.log('Counts:', { uDeniCount, uErtyCount, atHomeCount, goingOutCount });
    
    // Sort dates
    dates.sort((a, b) => a - b);
    
    // First date
    const firstDate = dates[0];
    const daysSinceFirst = firstDate ? Math.floor((new Date() - firstDate) / (1000 * 60 * 60 * 24)) : 0;
    
    // Most active month
    let mostActiveMonth = '';
    let maxCount = 0;
    for (const [month, count] of Object.entries(monthCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostActiveMonth = month;
      }
    }
    
    // Format most active month
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let mostActiveMonthFormatted = '';
    if (mostActiveMonth) {
      const [year, month] = mostActiveMonth.split('-');
      mostActiveMonthFormatted = `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    
    // Average dates per week
    const weeksSinceFirst = daysSinceFirst / 7;
    const avgPerWeek = weeksSinceFirst > 0 ? (totalDates / weeksSinceFirst).toFixed(1) : 0;
    
    return {
      totalDates,
      uDeniCount,
      uErtyCount,
      atHomeCount,
      goingOutCount,
      daysSinceFirst,
      mostActiveMonth: mostActiveMonthFormatted,
      mostActiveCount: maxCount,
      avgPerWeek
    };
  }

  function renderStatistics() {
    const stats = calculateStatistics();
    const statsContainer = document.getElementById('relationshipStats');
    
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">💕</div>
          <p class="stat-title">Total Dates</p>
          <div class="stat-value">${stats.totalDates}</div>
          <p class="stat-detail">memories together</p>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">🏠</div>
          <p class="stat-title">At Home</p>
          <div class="location-breakdown">
            <div class="location-item deni">
              <div class="location-name">U Deni</div>
              <div class="location-count">${stats.uDeniCount}</div>
            </div>
            <div class="location-item erty">
              <div class="location-name">U Erty</div>
              <div class="location-count">${stats.uErtyCount}</div>
            </div>
          </div>
          <p class="stat-detail">${stats.atHomeCount} total at home</p>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🎉</div>
          <p class="stat-title">Going Out</p>
          <div class="stat-value">${stats.goingOutCount}</div>
          <p class="stat-detail">dates & adventures</p>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">🔥</div>
          <p class="stat-title">Most Active Month</p>
          <div class="stat-value" style="font-size: 1.8rem;">${stats.mostActiveMonth || 'N/A'}</div>
          <p class="stat-detail">${stats.mostActiveCount} dates that month</p>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <p class="stat-title">Average Dates</p>
          <div class="stat-value">${stats.avgPerWeek}</div>
          <p class="stat-detail">times per week</p>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">${stats.uDeniCount > stats.uErtyCount ? '🏠' : '🏡'}</div>
          <p class="stat-title">Favorite Spot</p>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${stats.uDeniCount > stats.uErtyCount ? 'U Deni' : stats.uErtyCount > stats.uDeniCount ? 'U Erty' : 'Tie!'}
          </div>
          <p class="stat-detail">
            ${stats.uDeniCount > stats.uErtyCount 
              ? `${stats.uDeniCount - stats.uErtyCount} more visits` 
              : stats.uErtyCount > stats.uDeniCount 
              ? `${stats.uErtyCount - stats.uDeniCount} more visits`
              : 'Equal visits'}
          </p>
        </div>
      </div>
    `;
  }

  // Make renderStatistics globally accessible
  window.renderStatistics = renderStatistics;
  
  // Initial render
  renderStatistics();
})();

/******************** DATE IDEAS ********************/
(function() {
  const showDateIdeaBtn = document.getElementById('showAddDateIdea');
  const dateIdeaModal = document.getElementById('addDateIdeaModal');
  const closeDateIdeaModalBtn = document.getElementById('closeDateIdeaModal');
  const cancelDateIdeaBtn = document.getElementById('cancelAddDateIdea');
  const addDateIdeaForm = document.getElementById('addDateIdeaForm');
  const dateIdeasList = document.getElementById('dateIdeasList');
  const scheduledDatesList = document.getElementById('scheduledDatesList');
  
  const dateIdeasCol = collection(db, 'dateIdeas');

  // Modal controls
  function openDateIdeaModal() {
    dateIdeaModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  
  function closeDateIdeaModal() {
    dateIdeaModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    addDateIdeaForm.reset();
  }

  showDateIdeaBtn.addEventListener('click', openDateIdeaModal);
  closeDateIdeaModalBtn.addEventListener('click', closeDateIdeaModal);
  cancelDateIdeaBtn.addEventListener('click', closeDateIdeaModal);

  // Add date idea
  addDateIdeaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(addDateIdeaForm);
    
    const dateIdea = {
      title: fd.get('title').trim(),
      place: fd.get('place').trim() || null,
      description: fd.get('description').trim() || null,
      scheduled: false,
      scheduledDate: null,
      createdAt: serverTimestamp()
    };

    if (!dateIdea.title) {
      alert('Please enter a title');
      return;
    }

    const docRef = await addDoc(dateIdeasCol, dateIdea);
    renderDateIdea(dateIdea, docRef.id);
    closeDateIdeaModal();
  });

  // Render single date idea
  function renderDateIdea(idea, docId) {
    const li = document.createElement('li');
    li.classList.add('date-idea-item');
    li.dataset.docId = docId;
    
    if (idea.scheduled) {
      li.classList.add('scheduled');
    }

    const placeText = idea.place ? `<span class="idea-place">📍 ${escapeHtml(idea.place)}</span>` : '';
    const descText = idea.description ? `<p class="idea-description">${escapeHtml(idea.description)}</p>` : '';
    const scheduleDate = idea.scheduledDate ? `<span class="scheduled-date">📅 ${formatDate(idea.scheduledDate)}</span>` : '';

    li.innerHTML = `
      <div class="idea-content">
        <h4 class="idea-title">${escapeHtml(idea.title)}</h4>
        ${placeText}
        ${descText}
        ${scheduleDate}
      </div>
      <div class="idea-actions">
        ${!idea.scheduled ? '<button class="schedule-btn">Schedule</button>' : '<button class="unschedule-btn">Unschedule</button>'}
      </div>
    `;

    // Right-click context menu for delete
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('Delete this date idea?')) {
        deleteDoc(doc(db, 'dateIdeas', docId));
        li.remove();
        updateScheduledDatesDisplay();
      }
    });

    // Schedule button
    const scheduleBtn = li.querySelector('.schedule-btn');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', async () => {
        // Create a date picker modal
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.style.cssText = 'padding: 0.5rem; font-size: 1rem; border: 2px solid var(--secondary-color); border-radius: 0.5rem;';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2);';
        
        const title = document.createElement('h3');
        title.textContent = 'Select Date';
        title.style.cssText = 'margin: 0 0 1rem 0; color: var(--secondary-color);';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 1rem;';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Schedule';
        confirmBtn.style.cssText = 'padding: 0.5rem 1rem; background: var(--secondary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding: 0.5rem 1rem; background: #999; color: white; border: none; border-radius: 0.5rem; cursor: pointer;';
        
        confirmBtn.addEventListener('click', async () => {
          if (dateInput.value) {
            await updateDoc(doc(db, 'dateIdeas', docId), {
              scheduled: true,
              scheduledDate: dateInput.value
            });
            await loadDateIdeas();
            modal.remove();
          } else {
            alert('Please select a date');
          }
        });
        
        cancelBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.remove();
        });
        
        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);
        dialog.appendChild(title);
        dialog.appendChild(dateInput);
        dialog.appendChild(buttonContainer);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        dateInput.focus();
      });
    }

    // Unschedule button
    const unscheduleBtn = li.querySelector('.unschedule-btn');
    if (unscheduleBtn) {
      unscheduleBtn.addEventListener('click', async () => {
        await updateDoc(doc(db, 'dateIdeas', docId), {
          scheduled: false,
          scheduledDate: null
        });
        await loadDateIdeas();
      });
    }

    // Add to appropriate list
    if (idea.scheduled) {
      const scheduledItem = li.cloneNode(true);
      
      // Right-click to delete scheduled item
      scheduledItem.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (confirm('Delete this date idea?')) {
          await deleteDoc(doc(db, 'dateIdeas', docId));
          await loadDateIdeas();
        }
      });
      
      scheduledItem.querySelector('.unschedule-btn').addEventListener('click', async () => {
        await updateDoc(doc(db, 'dateIdeas', docId), {
          scheduled: false,
          scheduledDate: null
        });
        await loadDateIdeas();
      });
      
      // Insert scheduled items sorted by date
      const existingScheduled = [...scheduledDatesList.children];
      let inserted = false;
      for (const existing of existingScheduled) {
        const existingDate = existing.querySelector('.scheduled-date')?.textContent.replace('📅 ', '') || '';
        if (idea.scheduledDate < existingDate) {
          scheduledDatesList.insertBefore(scheduledItem, existing);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        scheduledDatesList.appendChild(scheduledItem);
      }
    }
    
    dateIdeasList.appendChild(li);
  }

  // Load all date ideas from Firebase
  async function loadDateIdeas() {
    dateIdeasList.innerHTML = '';
    scheduledDatesList.innerHTML = '';
    
    const snap = await getDocs(dateIdeasCol);
    const ideas = [];
    snap.forEach(docSnap => {
      ideas.push({ ...docSnap.data(), docId: docSnap.id });
    });
    
    // Sort: unscheduled first, then scheduled by date
    ideas.sort((a, b) => {
      if (a.scheduled && !b.scheduled) return 1;
      if (!a.scheduled && b.scheduled) return -1;
      if (a.scheduled && b.scheduled) {
        return (a.scheduledDate || '').localeCompare(b.scheduledDate || '');
      }
      return 0;
    });
    
    ideas.forEach(idea => renderDateIdea(idea, idea.docId));
    updateScheduledDatesDisplay();
  }

  function updateScheduledDatesDisplay() {
    const scheduledSection = document.getElementById('scheduledDatesSection');
    if (scheduledDatesList.children.length === 0) {
      scheduledDatesList.innerHTML = '<p style="color: #999; font-style: italic;">No scheduled dates yet</p>';
    }
  }

  // Initial load
  loadDateIdeas();
})();

/******************** SHARED PHOTOS GALLERY ********************/
(function() {
  const showPhotoBtn = document.getElementById('showAddPhoto');
  const photoModal = document.getElementById('addPhotoModal');
  const closePhotoModalBtn = document.getElementById('closePhotoModal');
  const cancelPhotoBtn = document.getElementById('cancelAddPhoto');
  const addPhotoForm = document.getElementById('addPhotoForm');
  const photoGallery = document.getElementById('photoGallery');
  
  // Check if all elements exist
  if (!showPhotoBtn || !photoModal || !closePhotoModalBtn || !cancelPhotoBtn || !addPhotoForm || !photoGallery) {
    console.error('Photo gallery elements not found:', {
      showPhotoBtn: !!showPhotoBtn,
      photoModal: !!photoModal,
      closePhotoModalBtn: !!closePhotoModalBtn,
      cancelPhotoBtn: !!cancelPhotoBtn,
      addPhotoForm: !!addPhotoForm,
      photoGallery: !!photoGallery
    });
    return;
  }
  
  const photosCol = collection(db, 'sharedPhotos');

  // Modal controls
  function openPhotoModal() {
    photoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  
  function closePhotoModal() {
    photoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    addPhotoForm.reset();
  }

  showPhotoBtn.addEventListener('click', openPhotoModal);
  closePhotoModalBtn.addEventListener('click', closePhotoModal);
  cancelPhotoBtn.addEventListener('click', closePhotoModal);

  // Add photo
  addPhotoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(addPhotoForm);
    
    const file = fd.get('photoFile');
    if (!file || file.size === 0) {
      alert('Please select a photo');
      return;
    }

    try {
      // Compress and convert image to base64
      const imageData = await compressImage(file);

      const photo = {
        title: fd.get('title')?.trim() || 'peika',
        date: fd.get('date') || new Date().toISOString().split('T')[0],
        caption: fd.get('caption')?.trim() || null,
        imageData: imageData,
        uploadedAt: serverTimestamp()
      };

      const docRef = await addDoc(photosCol, photo);
      renderPhoto(photo, docRef.id);
      closePhotoModal();
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo: ' + error.message);
    }
  });

  // Compress image to fit Firestore limits
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions (max 800px width/height)
          let width = img.width;
          let height = img.height;
          const maxSize = 800;
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels until size is acceptable
          let quality = 0.7;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Firestore limit is ~1MB, leave some room for other fields
          const maxBytes = 900000; // ~900KB
          while (dataUrl.length > maxBytes && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          
          if (dataUrl.length > maxBytes) {
            reject(new Error('Image too large even after compression'));
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // Render single photo
  function renderPhoto(photo, docId) {
    const photoItem = document.createElement('div');
    photoItem.classList.add('photo-item');
    photoItem.dataset.docId = docId;

    photoItem.innerHTML = `
      <img src="${photo.imageData}" alt="${escapeHtml(photo.caption || 'Shared photo')}" class="gallery-photo" />
    `;

    // Click to view full photo
    photoItem.addEventListener('click', (e) => {
      e.stopPropagation();
      showPhotoModal(photo, docId);
    });

    // Right-click context menu
    photoItem.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      
      // Create context menu
      const contextMenu = document.createElement('div');
      contextMenu.style.cssText = 'position:fixed;background:#fff;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10000;padding:0.3rem 0;';
      contextMenu.style.left = e.clientX + 'px';
      contextMenu.style.top = e.clientY + 'px';
      
      // Edit button
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;';
      editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#f0f0f0');
      editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'none');
      editBtn.addEventListener('click', () => {
        openEditDialog(photo, docId);
        contextMenu.remove();
      });
      
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;color:#d32f2f;';
      deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#ffebee');
      deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'none');
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Delete this photo?')) {
          await deleteDoc(doc(db, 'sharedPhotos', docId));
          photoItem.remove();
        }
        contextMenu.remove();
      });
      
      contextMenu.appendChild(editBtn);
      contextMenu.appendChild(deleteBtn);
      document.body.appendChild(contextMenu);
      
      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', () => contextMenu.remove(), { once: true });
      }, 0);
    });

    photoGallery.appendChild(photoItem);
  }

  // Shared function to open edit dialog
  function openEditDialog(photo, docId, backElement, frontElement) {
    // Create edit modal
    const editModal = document.createElement('div');
    editModal.className = 'modal';
    editModal.setAttribute('aria-hidden', 'false');
    editModal.style.display = 'flex';
    
    const displayTitle = photo.title || 'peika';
    const displayDate = photo.date || new Date().toISOString().split('T')[0];
    
    editModal.innerHTML = `
      <div class="modal-dialog" role="document">
        <button class="modal-close" aria-label="Close form">✕</button>
        <form class="add-event-form" style="width: 100%;">
          <h3 style="color: #222; margin-bottom: 1rem;">Edit Photo</h3>
          <input type="text" name="title" placeholder="Title" value="${escapeHtml(displayTitle)}" required />
          <input type="date" name="date" value="${displayDate}" required />
          <textarea name="caption" placeholder="Description" rows="4">${escapeHtml(photo.caption || '')}</textarea>
          <div class="form-actions">
            <button type="submit">Save</button>
            <button type="button" class="cancel-edit">Cancel</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(editModal);
    
    // Auto-focus on caption field
    const captionField = editModal.querySelector('[name="caption"]');
    setTimeout(() => captionField.focus(), 100);
    
    const form = editModal.querySelector('form');
    const closeEditModal = () => {
      editModal.remove();
    };
    
    editModal.querySelector('.modal-close').addEventListener('click', closeEditModal);
    editModal.querySelector('.cancel-edit').addEventListener('click', closeEditModal);
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const newTitle = fd.get('title').trim();
      const newDate = fd.get('date');
      const newCaption = fd.get('caption').trim();
      
      if (docId) {
        await updateDoc(doc(db, 'sharedPhotos', docId), { 
          title: newTitle,
          date: newDate,
          caption: newCaption 
        });
        
        // Update display if elements provided
        if (backElement) {
          backElement.querySelector('h3').textContent = newTitle;
          backElement.querySelector('.back-date').textContent = formatDate(newDate);
          backElement.querySelector('.back-caption').textContent = newCaption;
          backElement.dataset.date = newDate;
        }
        if (frontElement) {
          frontElement.querySelector('.polaroid-date').textContent = formatDate(newDate);
        }
        
        loadPhotos(); // Refresh gallery
      }
      closeEditModal();
    });
  }

  // Show full-size photo modal in polaroid style
  function showPhotoModal(photo, docId) {
    const { imageData, caption, title, date } = photo;
    const displayTitle = title || 'peika';
    const displayDate = date || new Date().toISOString().split('T')[0];
    
    const modal = document.createElement('div');
    modal.className = 'photo-modal-overlay';
    
    const polaroid = document.createElement('div');
    polaroid.className = 'polaroid';
    
    const polaroidInner = document.createElement('div');
    polaroidInner.className = 'polaroid-inner';
    
    // Front side (photo)
    const front = document.createElement('div');
    front.className = 'polaroid-front';
    front.innerHTML = `
      <div class="polaroid-photo">
        <img src="${imageData}" alt="Photo" />
      </div>
      <div class="polaroid-date">${formatDate(displayDate)}</div>
    `;
    
    // Back side (caption)
    const back = document.createElement('div');
    back.className = 'polaroid-back';
    back.dataset.date = displayDate;
    back.innerHTML = `
      <div class="polaroid-back-content">
        <h3>${escapeHtml(displayTitle)}</h3>
        <p class="back-date">${formatDate(displayDate)}</p>
        <div class="back-caption">${colorizeNames(escapeHtml(caption || ''))}</div>
      </div>
    `;
    
    polaroidInner.appendChild(front);
    polaroidInner.appendChild(back);
    polaroid.appendChild(polaroidInner);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'photo-modal-close';
    closeBtn.innerHTML = '✕';
    
    modal.appendChild(polaroid);
    modal.appendChild(closeBtn);
    
    // Flip polaroid on click (but not on buttons)
    polaroid.addEventListener('click', (e) => {
      e.stopPropagation();
      polaroidInner.classList.toggle('flipped');
    });
    
    // Right-click context menu on polaroid
    polaroid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      // Create context menu
      const contextMenu = document.createElement('div');
      contextMenu.style.cssText = 'position:fixed;background:#fff;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10001;padding:0.3rem 0;';
      contextMenu.style.left = e.clientX + 'px';
      contextMenu.style.top = e.clientY + 'px';
      
      // Edit button
      const ctxEditBtn = document.createElement('button');
      ctxEditBtn.textContent = 'Edit';
      ctxEditBtn.style.cssText = 'display:block;width:100%;padding:0.4rem 1rem;background:none;border:none;text-align:left;cursor:pointer;';
      ctxEditBtn.addEventListener('mouseenter', () => ctxEditBtn.style.background = '#f0f0f0');
      ctxEditBtn.addEventListener('mouseleave', () => ctxEditBtn.style.background = 'none');
      ctxEditBtn.addEventListener('click', async () => {
        openEditDialog(photo, docId, back, front);
        contextMenu.remove();
      });
      
      contextMenu.appendChild(ctxEditBtn);
      document.body.appendChild(contextMenu);
      
      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', () => contextMenu.remove(), { once: true });
      }, 0);
    });
    
    // Close modal
    const closeModal = () => {
      modal.remove();
      document.removeEventListener('keydown', handleEsc);
    };
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEsc);
    
    document.body.appendChild(modal);
  }

  // Load all photos from Firebase
  async function loadPhotos() {
    try {
      photoGallery.innerHTML = '';
      
      const snap = await getDocs(photosCol);
      
      // Convert to array and sort by date (most recent first)
      const photos = [];
      snap.forEach(docSnap => {
        photos.push({ data: docSnap.data(), id: docSnap.id });
      });
      
      photos.sort((a, b) => {
        const dateA = a.data.date || '';
        const dateB = b.data.date || '';
        return dateB.localeCompare(dateA); // Descending order (newest first)
      });
      
      photos.forEach(photo => {
        renderPhoto(photo.data, photo.id);
      });
    } catch (error) {
      console.error('Error loading photos:', error);
      photoGallery.innerHTML = '<p style="color: #999; font-style: italic; text-align: center; padding: 2rem;">Failed to load photos. Please refresh the page.</p>';
    }
  }

  // Initial load
  loadPhotos();
})();

/******************** DATE RANKINGS ********************/
(function() {
  const editDeniBtn = document.getElementById('editDeniRanking');
  const editErtyBtn = document.getElementById('editErtyRanking');
  const deniRankingList = document.getElementById('deniRankingList');
  const ertyRankingList = document.getElementById('ertyRankingList');
  
  const rankingModal = document.getElementById('editRankingModal');
  const closeRankingModalBtn = document.getElementById('closeRankingModal');
  const cancelRankingBtn = document.getElementById('cancelRanking');
  const saveRankingBtn = document.getElementById('saveRanking');
  const rankingModalTitle = document.getElementById('rankingModalTitle');
  const rankingEditor = document.getElementById('rankingEditor');
  
  const noteModal = document.getElementById('addRankingNoteModal');
  const closeNoteModalBtn = document.getElementById('closeNoteModal');
  const cancelNoteBtn = document.getElementById('cancelNote');
  const noteModalTitle = document.getElementById('noteModalTitle');
  const rankingNoteForm = document.getElementById('rankingNoteForm');
  
  const rankingsCol = collection(db, 'dateRankings');
  
  let currentEditor = null; // 'deni' or 'erty'
  let currentRankings = [];
  let currentNoteItem = null;

  // Modal controls
  function openRankingModal(person) {
    currentEditor = person;
    rankingModalTitle.textContent = person === 'deni' ? "Edit Deni's Rankings" : "Edit Erty's Rankings";
    loadRankingEditor();
    rankingModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  
  function closeRankingModal() {
    rankingModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentEditor = null;
    currentRankings = [];
  }

  function openNoteModal(item) {
    currentNoteItem = item;
    const event = getEventById(item.eventId);
    noteModalTitle.textContent = event ? event.title : 'Add Note';
    rankingNoteForm.querySelector('[name="note"]').value = item.note || '';
    noteModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  
  function closeNoteModal() {
    noteModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentNoteItem = null;
    rankingNoteForm.reset();
  }

  // Event listeners
  editDeniBtn.addEventListener('click', () => openRankingModal('deni'));
  editErtyBtn.addEventListener('click', () => openRankingModal('erty'));
  closeRankingModalBtn.addEventListener('click', closeRankingModal);
  cancelRankingBtn.addEventListener('click', closeRankingModal);
  closeNoteModalBtn.addEventListener('click', closeNoteModal);
  cancelNoteBtn.addEventListener('click', closeNoteModal);

  // Get all timeline events (excluding online dates)
  function getAllDates() {
    const timelineItems = document.querySelectorAll('.timeline li[data-iso]');
    const dates = [];
    
    timelineItems.forEach(item => {
      const isOnline = item.dataset.online === 'true';
      if (!isOnline) {
        const title = item.querySelector('.title')?.textContent.trim();
        const dateStr = item.dataset.iso;
        const docId = item.dataset.docId;
        
        if (title && dateStr && docId) {
          dates.push({
            eventId: docId,
            title: title,
            date: dateStr,
            formattedDate: formatDate(dateStr)
          });
        }
      }
    });
    
    return dates.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function getEventById(eventId) {
    const dates = getAllDates();
    return dates.find(d => d.eventId === eventId);
  }

  // Load ranking editor with all dates
  async function loadRankingEditor() {
    const allDates = getAllDates();
    const existingRankings = await loadRankingsFromFirebase(currentEditor);
    
    currentRankings = existingRankings.map(r => ({
      eventId: r.eventId,
      note: r.note || ''
    }));
    
    rankingEditor.innerHTML = '';
    
    // Create ranked section
    const rankedSection = document.createElement('div');
    rankedSection.className = 'ranking-section';
    rankedSection.innerHTML = '<h4 style="color: #666; font-size: 0.95rem; margin-bottom: 0.5rem; padding-left: 0.5rem;">📌 Your Top Rankings (Drag to reorder)</h4>';
    const rankedContainer = document.createElement('div');
    rankedContainer.className = 'ranked-container';
    rankedContainer.id = 'rankedContainer';
    
    // Add ranked dates
    currentRankings.forEach((ranking, index) => {
      const event = getEventById(ranking.eventId);
      if (event) {
        const item = createRankingEditorItem(event, index + 1, ranking.note, true);
        rankedContainer.appendChild(item);
      }
    });
    
    rankedSection.appendChild(rankedContainer);
    rankingEditor.appendChild(rankedSection);
    
    // Create unranked section
    const unrankedSection = document.createElement('div');
    unrankedSection.className = 'ranking-section';
    unrankedSection.style.marginTop = '1.5rem';
    unrankedSection.innerHTML = '<h4 style="color: #666; font-size: 0.95rem; margin-bottom: 0.5rem; padding-left: 0.5rem;">📋 All Dates (Drag to ranking above)</h4>';
    const unrankedContainer = document.createElement('div');
    unrankedContainer.className = 'unranked-container';
    unrankedContainer.id = 'unrankedContainer';
    
    // Add unranked dates
    allDates.forEach(date => {
      const isRanked = currentRankings.some(r => r.eventId === date.eventId);
      if (!isRanked) {
        const item = createRankingEditorItem(date, null, '', false);
        unrankedContainer.appendChild(item);
      }
    });
    
    unrankedSection.appendChild(unrankedContainer);
    rankingEditor.appendChild(unrankedSection);
    
    setupDragAndDrop();
  }

  function createRankingEditorItem(event, rank, note, isRanked) {
    const item = document.createElement('div');
    item.classList.add('ranking-editor-item');
    item.draggable = true;
    item.dataset.eventId = event.eventId;
    if (isRanked) item.classList.add('ranked');
    
    item.innerHTML = `
      <span class="drag-handle">☰</span>
      <div class="ranking-item-content">
        <div class="ranking-item-title">${escapeHtml(event.title)}</div>
        <div class="ranking-item-date">${event.formattedDate}</div>
        ${note ? `<div class="ranking-item-note" style="font-size: 0.85rem; color: #666; margin-top: 0.3rem; font-style: italic;">${escapeHtml(note)}</div>` : ''}
      </div>
      <div class="ranking-item-actions">
        ${rank ? `<span class="ranking-item-number">${rank}</span>` : ''}
        <button class="add-note-btn" data-event-id="${event.eventId}">📝 Note</button>
      </div>
    `;
    
    // Add note button
    const noteBtn = item.querySelector('.add-note-btn');
    noteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const eventId = noteBtn.dataset.eventId;
      let rankingItem = currentRankings.find(r => r.eventId === eventId);
      if (!rankingItem) {
        rankingItem = { eventId: eventId, note: '' };
        currentRankings.push(rankingItem);
      }
      openNoteModal(rankingItem);
    });
    
    return item;
  }

  // Drag and drop functionality
  function setupDragAndDrop() {
    const items = rankingEditor.querySelectorAll('.ranking-editor-item');
    const rankedContainer = document.getElementById('rankedContainer');
    const unrankedContainer = document.getElementById('unrankedContainer');
    let draggedItem = null;
    
    items.forEach(item => {
      item.addEventListener('dragstart', function(e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      
      item.addEventListener('dragend', function(e) {
        this.classList.remove('dragging');
        updateRankingsFromEditor();
        updateRankingNumbers(); // Just update numbers, don't reload everything
      });
      
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (draggedItem !== this) {
          const rect = this.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          
          if (e.clientY < midpoint) {
            this.parentNode.insertBefore(draggedItem, this);
          } else {
            this.parentNode.insertBefore(draggedItem, this.nextSibling);
          }
        }
      });
    });
    
    // Allow dropping on containers
    [rankedContainer, unrankedContainer].forEach(container => {
      container.addEventListener('dragover', function(e) {
        e.preventDefault();
      });
      
      container.addEventListener('drop', function(e) {
        e.preventDefault();
        if (draggedItem && this.children.length === 0) {
          this.appendChild(draggedItem);
        }
      });
    });
  }

  function updateRankingNumbers() {
    const rankedContainer = document.getElementById('rankedContainer');
    if (!rankedContainer) return;
    
    const items = rankedContainer.querySelectorAll('.ranking-editor-item');
    items.forEach((item, index) => {
      // Update or add ranking number
      let numberSpan = item.querySelector('.ranking-item-number');
      const actionsDiv = item.querySelector('.ranking-item-actions');
      
      if (!numberSpan) {
        numberSpan = document.createElement('span');
        numberSpan.className = 'ranking-item-number';
        actionsDiv.insertBefore(numberSpan, actionsDiv.firstChild);
      }
      
      numberSpan.textContent = index + 1;
      item.classList.add('ranked');
    });
    
    // Remove numbers from unranked items
    const unrankedContainer = document.getElementById('unrankedContainer');
    if (unrankedContainer) {
      const unrankedItems = unrankedContainer.querySelectorAll('.ranking-editor-item');
      unrankedItems.forEach(item => {
        const numberSpan = item.querySelector('.ranking-item-number');
        if (numberSpan) numberSpan.remove();
        item.classList.remove('ranked');
      });
    }
  }

  function updateRankingsFromEditor() {
    const rankedContainer = document.getElementById('rankedContainer');
    if (!rankedContainer) return;
    
    const items = Array.from(rankedContainer.querySelectorAll('.ranking-editor-item'));
    const newRankings = [];
    
    items.forEach((item, index) => {
      const eventId = item.dataset.eventId;
      const existingRanking = currentRankings.find(r => r.eventId === eventId);
      
      newRankings.push({
        eventId: eventId,
        note: existingRanking ? existingRanking.note : ''
      });
    });
    
    currentRankings = newRankings;
  }

  // Save note
  rankingNoteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = rankingNoteForm.querySelector('[name="note"]').value.trim();
    
    if (currentNoteItem) {
      currentNoteItem.note = note;
      loadRankingEditor(); // Refresh to show note
    }
    
    closeNoteModal();
  });

  // Save rankings
  saveRankingBtn.addEventListener('click', async () => {
    updateRankingsFromEditor();
    
    // Only save the first 10 (or all if less than 10)
    const topRankings = currentRankings.slice(0, 10);
    
    await saveRankingsToFirebase(currentEditor, topRankings);
    closeRankingModal();
    loadRankings();
  });

  // Load rankings from Firebase
  async function loadRankingsFromFirebase(person) {
    const docRef = doc(db, 'dateRankings', person);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().rankings || [];
    }
    return [];
  }

  // Save rankings to Firebase
  async function saveRankingsToFirebase(person, rankings) {
    const docRef = doc(db, 'dateRankings', person);
    await setDoc(docRef, {
      rankings: rankings,
      updatedAt: serverTimestamp()
    });
  }

  // Render rankings in the display
  async function loadRankings() {
    // Load Deni's rankings
    const deniRankings = await loadRankingsFromFirebase('deni');
    renderRankingList(deniRankingList, deniRankings);
    
    // Load Erty's rankings
    const ertyRankings = await loadRankingsFromFirebase('erty');
    renderRankingList(ertyRankingList, ertyRankings);
  }

  function renderRankingList(listElement, rankings) {
    listElement.innerHTML = '';
    
    if (rankings.length === 0) {
      listElement.classList.add('empty');
      return;
    }
    
    listElement.classList.remove('empty');
    
    rankings.forEach(ranking => {
      const event = getEventById(ranking.eventId);
      if (event) {
        const li = document.createElement('li');
        
        li.innerHTML = `
          <div class="ranking-date-title">${escapeHtml(event.title)}</div>
          <div class="ranking-date-info">${event.formattedDate}</div>
          ${ranking.note ? `<div class="ranking-date-note">${escapeHtml(ranking.note)}</div>` : ''}
        `;
        
        listElement.appendChild(li);
      }
    });
  }

  // Initial load
  loadRankings();
  
  // Make globally accessible for updates
  window.updateRankings = loadRankings;
})();

/******************** PROMISES ********************/
(function() {
  const showPromiseBtn = document.getElementById('showAddPromise');
  const promiseModal = document.getElementById('addPromiseModal');
  const closePromiseModalBtn = document.getElementById('closePromiseModal');
  const cancelPromiseBtn = document.getElementById('cancelAddPromise');
  const addPromiseForm = document.getElementById('addPromiseForm');
  const promisesList = document.getElementById('promisesList');
  
  const promisesCol = collection(db, 'promises');

  // Modal controls
  function openPromiseModal() {
    promiseModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  
  function closePromiseModal() {
    promiseModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    addPromiseForm.reset();
  }

  showPromiseBtn.addEventListener('click', openPromiseModal);
  closePromiseModalBtn.addEventListener('click', closePromiseModal);
  cancelPromiseBtn.addEventListener('click', closePromiseModal);

  // Add promise
  addPromiseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(addPromiseForm);
    
    const promise = {
      promise: fd.get('promise').trim(),
      promiseMaker: fd.get('promiseMaker'),
      promiseDate: fd.get('promiseDate') || null,
      fulfilled: fd.get('fulfilled') === 'on',
      createdAt: serverTimestamp()
    };

    if (!promise.promise || !promise.promiseMaker) {
      alert('Please fill in all required fields');
      return;
    }

    const docRef = await addDoc(promisesCol, promise);
    renderPromise(promise, docRef.id);
    closePromiseModal();
  });

  // Render single promise
  function renderPromise(promise, docId) {
    const promiseItem = document.createElement('div');
    promiseItem.classList.add('promise-item', promise.promiseMaker);
    promiseItem.dataset.docId = docId;
    
    if (promise.fulfilled) {
      promiseItem.classList.add('fulfilled');
    }

    const makerText = promise.promiseMaker === 'both' ? 'Both' : 
                     promise.promiseMaker === 'deni' ? 'Deni' : 'Erty';
    
    const dateText = promise.promiseDate ? 
      `<div class="promise-date">📅 ${formatDate(promise.promiseDate)}</div>` : '';

    promiseItem.innerHTML = `
      <div class="promise-header">
        <span class="promise-maker">${makerText}</span>
      </div>
      <div class="promise-text">"${escapeHtml(promise.promise)}"</div>
      ${dateText}
      <div class="promise-actions">
        <button class="toggle-fulfill-btn">${promise.fulfilled ? 'Unfulfill' : 'Mark Fulfilled'}</button>
        <button class="delete-promise-btn">Delete</button>
      </div>
    `;

    // Toggle fulfill button
    const toggleBtn = promiseItem.querySelector('.toggle-fulfill-btn');
    toggleBtn.addEventListener('click', async () => {
      const newFulfilled = !promise.fulfilled;
      await updateDoc(doc(db, 'promises', docId), {
        fulfilled: newFulfilled
      });
      loadPromises(); // Refresh
    });

    // Delete button
    const deleteBtn = promiseItem.querySelector('.delete-promise-btn');
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Delete this promise?')) {
        await deleteDoc(doc(db, 'promises', docId));
        promiseItem.remove();
      }
    });

    promisesList.appendChild(promiseItem);
  }

  // Load all promises from Firebase
  async function loadPromises() {
    promisesList.innerHTML = '';
    
    const snap = await getDocs(promisesCol);
    const promises = [];
    
    snap.forEach(docSnap => {
      promises.push({ ...docSnap.data(), docId: docSnap.id });
    });
    
    // Sort: unfulfilled first, then by date
    promises.sort((a, b) => {
      if (a.fulfilled && !b.fulfilled) return 1;
      if (!a.fulfilled && b.fulfilled) return -1;
      
      // If both same fulfilled status, sort by date (newest first)
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
    
    promises.forEach(promise => renderPromise(promise, promise.docId));
  }

  // Initial load
  loadPromises();
})();
