// Where the backend is running. The frontend is a separate app on a different
// port (5173), so it needs the backend's full address.
const API_URL = 'http://localhost:3000';

// The page elements we read from or write to (see the ids in index.html)
const monthInput = document.querySelector('#month');
const showAllButton = document.querySelector('#show-all');
const summaryText = document.querySelector('#summary');
const formTitle = document.querySelector('#form-title');
const form = document.querySelector('#form');
const cancelButton = document.querySelector('#cancel');
const message = document.querySelector('#message');
const rows = document.querySelector('#rows');

// Which transaction the form is editing. null = the form is adding a new one.
let editingId = null;

// ---------------------------------------------------------------------------
// Talking to the backend
// ---------------------------------------------------------------------------

// Every request goes through here: send JSON, read JSON, and turn error
// responses into an Error with a readable message.
async function api(method, path, body) {
  let response;
  try {
    response = await fetch(API_URL + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only throws when it gets no answer at all
    throw new Error(`Can't reach the backend at ${API_URL}. Is it running?`);
  }

  if (response.status === 204) return null; // DELETE answers with no body

  const data = await response.json();
  if (!response.ok) {
    // Our API sends { errors: [...] } for 400 and { error: '...' } for 404/500
    throw new Error(data.errors ? data.errors.join('. ') : data.error);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// The backend stores cents (1250); people read and type dollars (12.50).
// Math.round because 12.34 * 100 = 1233.9999999999998 in JavaScript.
const toDollars = (cents) => (cents / 100).toFixed(2);
const toCents = (dollars) => Math.round(Number(dollars) * 100);

// '' when no month is picked, so the backend returns everything
const monthQuery = () => (monthInput.value ? `?month=${monthInput.value}` : '');

const showMessage = (text) => { message.textContent = text; };

function makeButton(label, onClick) {
  const button = document.createElement('button');
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

// ---------------------------------------------------------------------------
// Drawing the page
// ---------------------------------------------------------------------------

// Ask the backend for fresh data and redraw the summary and the table
async function refresh() {
  try {
    const transactions = await api('GET', '/transactions' + monthQuery());
    const summary = await api('GET', '/summary' + monthQuery());

    summaryText.textContent =
      `Income $${toDollars(summary.incomeCents)} · ` +
      `Expenses $${toDollars(summary.expenseCents)} · ` +
      `Balance $${toDollars(summary.balanceCents)}`;

    rows.replaceChildren(); // remove the old rows
    for (const t of transactions) {
      const tr = document.createElement('tr');
      // textContent (never innerHTML): text a user typed is shown as text,
      // never run as HTML or code
      for (const value of [t.date, t.type, t.category, t.description, toDollars(t.amountCents)]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      const buttons = document.createElement('td');
      buttons.append(
        makeButton('Edit', () => startEditing(t.id)),
        makeButton('Delete', () => deleteTransaction(t.id)),
      );
      tr.append(buttons);
      rows.append(tr);
    }
  } catch (error) {
    showMessage(error.message);
  }
}

// ---------------------------------------------------------------------------
// Add, edit, delete
// ---------------------------------------------------------------------------

form.addEventListener('submit', async (event) => {
  event.preventDefault(); // stop the browser's default "reload the page"

  const fields = new FormData(form); // reads every input by its name=""
  const body = {
    type: fields.get('type'),
    amountCents: toCents(fields.get('amount')),
    category: fields.get('category'),
    description: fields.get('description'),
  };
  // Leave the date out when it's empty, so the backend uses today
  if (fields.get('date')) body.date = fields.get('date');

  try {
    if (editingId === null) {
      await api('POST', '/transactions', body);
    } else {
      await api('PUT', `/transactions/${editingId}`, body);
    }
    stopEditing();
    showMessage('');
    await refresh();
  } catch (error) {
    showMessage(error.message); // e.g. the backend's 400 validation errors
  }
});

// Load one transaction into the form and switch the form to "edit" mode
async function startEditing(id) {
  try {
    const t = await api('GET', `/transactions/${id}`);
    form.elements.type.value = t.type;
    form.elements.amount.value = toDollars(t.amountCents);
    form.elements.category.value = t.category;
    form.elements.description.value = t.description;
    form.elements.date.value = t.date;
    editingId = id;
    formTitle.textContent = `Edit transaction #${id}`;
    cancelButton.hidden = false;
    showMessage('');
  } catch (error) {
    showMessage(error.message);
  }
}

// Empty the form and switch it back to "add" mode
function stopEditing() {
  editingId = null;
  form.reset();
  formTitle.textContent = 'Add a transaction';
  cancelButton.hidden = true;
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await api('DELETE', `/transactions/${id}`);
    if (editingId === id) stopEditing();
    await refresh();
  } catch (error) {
    showMessage(error.message);
  }
}

// ---------------------------------------------------------------------------
// Wire up the remaining buttons, then load the data once on page load
// ---------------------------------------------------------------------------

cancelButton.addEventListener('click', stopEditing);
monthInput.addEventListener('change', refresh);
showAllButton.addEventListener('click', () => {
  monthInput.value = '';
  refresh();
});

refresh();
