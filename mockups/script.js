// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Show corresponding page
        const pageId = item.dataset.page + '-page';
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    });
});

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Type selector in appointment modal
document.querySelectorAll('.type-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
    });
});

// Day selector in appointment modal
document.querySelectorAll('.day-option').forEach(option => {
    option.addEventListener('click', () => {
        option.classList.toggle('selected');
        const checkbox = option.querySelector('input');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
        }
    });
});

// Recurrence options visibility
const recurrenceSelect = document.getElementById('recurrence-select');
if (recurrenceSelect) {
    recurrenceSelect.addEventListener('change', () => {
        const recurrenceOptions = document.querySelector('.recurrence-options');
        if (recurrenceSelect.value === 'none') {
            recurrenceOptions.style.display = 'none';
        } else {
            recurrenceOptions.style.display = 'block';
        }
    });
}

// Simulate drag & drop on calendar events
document.querySelectorAll('.event').forEach(event => {
    event.setAttribute('draggable', true);

    event.addEventListener('dragstart', (e) => {
        e.target.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
    });

    event.addEventListener('dragend', (e) => {
        e.target.style.opacity = '1';
    });
});

// Calendar day events as drop zones
document.querySelectorAll('.day-events').forEach(dayEvents => {
    dayEvents.addEventListener('dragover', (e) => {
        e.preventDefault();
        dayEvents.style.background = 'rgba(79, 70, 229, 0.1)';
    });

    dayEvents.addEventListener('dragleave', () => {
        dayEvents.style.background = '';
    });

    dayEvents.addEventListener('drop', (e) => {
        e.preventDefault();
        dayEvents.style.background = '';
        // In real app, this would handle the appointment move
    });
});

// Click on empty calendar slot to create appointment
document.querySelectorAll('.day-events').forEach(dayEvents => {
    dayEvents.addEventListener('click', (e) => {
        // Only trigger if clicking on the background, not on an event
        if (e.target === dayEvents) {
            openModal('appointment-modal');
        }
    });
});

// Table row selection
document.querySelectorAll('.data-table tbody input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const row = checkbox.closest('tr');
        if (checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
});

// Select all checkbox in table header
document.querySelectorAll('.data-table thead input[type="checkbox"]').forEach(headerCheckbox => {
    headerCheckbox.addEventListener('change', () => {
        const table = headerCheckbox.closest('table');
        const bodyCheckboxes = table.querySelectorAll('tbody input[type="checkbox"]');
        bodyCheckboxes.forEach(checkbox => {
            checkbox.checked = headerCheckbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });
    });
});

// View toggle buttons
document.querySelectorAll('.view-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Trainer filter checkboxes
document.querySelectorAll('.trainer-filters input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const trainerName = checkbox.parentElement.querySelector('span').textContent.toLowerCase();
        const events = document.querySelectorAll(`.event.trainer-${trainerName}`);
        events.forEach(event => {
            event.style.display = checkbox.checked ? 'block' : 'none';
        });
    });
});

// Color picker
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
    });
});

// Initialize: show today indicator animation
const timeIndicator = document.querySelector('.current-time-indicator');
if (timeIndicator) {
    // Pulse animation
    timeIndicator.style.animation = 'pulse 2s ease-in-out infinite';
}

// Add some CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .data-table tbody tr.selected {
        background: var(--primary-light) !important;
    }

    .event {
        cursor: grab;
    }

    .event:active {
        cursor: grabbing;
    }
`;
document.head.appendChild(style);

console.log('PT Planner Mockup loaded successfully!');
console.log('Click on navigation items to explore different pages.');
console.log('Click on calendar events to see details.');
console.log('Try dragging events to simulate drag & drop functionality.');
