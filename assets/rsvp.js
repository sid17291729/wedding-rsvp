// Wedding RSVP form — Google sign-in, one editable RSVP per email.

const SIDE = document.body.dataset.side;

const signinGate = document.getElementById("signin-gate");
const signinError = document.getElementById("signin-error");
const formIntro = document.getElementById("form-intro");
const formHeading = document.getElementById("form-heading");
const formSubtitle = document.getElementById("form-subtitle");
const signedInAs = document.getElementById("signed-in-as");

const form = document.getElementById("rsvp-form");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const guestsField = document.getElementById("guests-field");
const guestsInput = document.getElementById("guests");
const messageInput = document.getElementById("message");

const thankYou = document.getElementById("thank-you");
const thankYouText = document.getElementById("thank-you-text");
const formError = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

let idToken = null;
let isEditing = false;

// Guest count is irrelevant when declining — hide it then
form.querySelectorAll("input[name='attending']").forEach((radio) => {
  radio.addEventListener("change", () => {
    const declining = form.attending.value === "No";
    guestsField.classList.toggle("hidden", declining);
  });
});

// --- Google sign-in -------------------------------------------------------

function initGoogleSignIn() {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith("PASTE_")) {
    return showSigninError(
      "Sign-in isn't configured yet (missing Google Client ID in assets/config.js)."
    );
  }
  if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    return showSigninError(
      "Google sign-in couldn't load. Please check your connection and refresh."
    );
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(document.getElementById("google-btn"), {
    theme: "filled_black",
    size: "large",
    shape: "pill",
    text: "signin_with",
    width: 260
  });
}

// Exposed on window so it can also serve as a GIS HTML callback / be testable.
window.handleCredentialResponse = handleCredentialResponse;

async function handleCredentialResponse(response) {
  idToken = response.credential;
  const claims = decodeJwt(idToken); // display only — the server re-verifies

  signinGate.classList.add("hidden");
  formIntro.classList.remove("hidden");
  form.classList.remove("hidden");

  if (claims) {
    if (claims.name) nameInput.value = claims.name;
    if (claims.email) emailInput.value = claims.email;
    signedInAs.textContent = claims.email ? "Signed in as " + claims.email : "";
  }

  // Look up an existing RSVP so the guest can edit it
  if (SCRIPT_URL && !SCRIPT_URL.startsWith("PASTE_")) {
    try {
      const body = new URLSearchParams();
      body.set("action", "lookup");
      body.set("credential", idToken);
      const res = await fetch(SCRIPT_URL, { method: "POST", body });
      const out = await res.json();
      if (out.result === "success" && out.found && out.entry) {
        prefillFromEntry(out.entry);
      }
    } catch (err) {
      // Non-fatal: they can still submit a fresh RSVP.
    }
  }
}

function prefillFromEntry(entry) {
  isEditing = true;
  if (entry.name) nameInput.value = entry.name;
  if (entry.phone) phoneInput.value = entry.phone;
  if (entry.attending === "Yes") document.getElementById("attend-yes").checked = true;
  if (entry.attending === "No") document.getElementById("attend-no").checked = true;
  guestsField.classList.toggle("hidden", entry.attending === "No");
  if (entry.guests) guestsInput.value = entry.guests;
  if (entry.message) messageInput.value = entry.message;

  formHeading.textContent = "Edit your RSVP";
  formSubtitle.textContent =
    "You've responded before — update anything you like and save again.";
  submitBtn.textContent = "Update RSVP";
}

function decodeJwt(token) {
  try {
    let part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = part.length % 4 ? "====".slice(part.length % 4) : "";
    const json = decodeURIComponent(
      atob(part + pad)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function showSigninError(msg) {
  signinError.textContent = msg;
  signinError.classList.remove("hidden");
}

function showFormError(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
}

// --- Submit (create or update) --------------------------------------------

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.classList.add("hidden");

  if (!idToken) {
    return showFormError("Please sign in with Google first.");
  }
  if (SCRIPT_URL.startsWith("PASTE_")) {
    return showFormError(
      "The form is not connected yet — the Apps Script URL is missing in assets/config.js."
    );
  }

  const label = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = isEditing ? "Updating…" : "Sending…";

  const attending = form.attending.value;
  const body = new URLSearchParams();
  body.set("action", "submit");
  body.set("credential", idToken);
  body.set("side", SIDE);
  body.set("name", nameInput.value);
  body.set("phone", phoneInput.value);
  body.set("attending", attending);
  body.set("guests", attending === "Yes" ? guestsInput.value : "0");
  body.set("message", messageInput.value);

  try {
    const res = await fetch(SCRIPT_URL, { method: "POST", body });
    const out = await res.json();
    if (out.result !== "success") throw new Error(out.error || "error");

    thankYouText.textContent =
      attending === "Yes"
        ? "We can't wait to celebrate with you!"
        : "We're sorry you can't make it — thank you for letting us know.";
    form.classList.add("hidden");
    formIntro.classList.add("hidden");
    thankYou.classList.remove("hidden");
  } catch (err) {
    showFormError(
      String(err.message) === "auth"
        ? "Your sign-in expired — please refresh the page and sign in again."
        : "Something went wrong saving your RSVP. Please try again, or contact us directly."
    );
    submitBtn.disabled = false;
    submitBtn.textContent = label;
  }
});

initGoogleSignIn();
