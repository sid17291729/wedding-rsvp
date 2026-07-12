const form = document.getElementById("rsvp-form");
const formIntro = document.getElementById("form-intro");
const guestsField = document.getElementById("guests-field");
const thankYou = document.getElementById("thank-you");
const thankYouText = document.getElementById("thank-you-text");
const formError = document.getElementById("form-error");
const submitBtn = form.querySelector("button[type='submit']");

// Guest count is irrelevant when declining — hide it then
form.querySelectorAll("input[name='attending']").forEach((radio) => {
  radio.addEventListener("change", () => {
    const declining = form.attending.value === "No";
    guestsField.classList.toggle("hidden", declining);
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.classList.add("hidden");

  if (SCRIPT_URL.startsWith("PASTE_")) {
    formError.textContent =
      "The form is not connected yet — the Apps Script URL is missing in assets/config.js.";
    formError.classList.remove("hidden");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

  const data = new FormData(form);
  data.append("side", document.body.dataset.side);
  if (form.attending.value !== "Yes") {
    data.set("guests", "0");
  }

  try {
    const res = await fetch(SCRIPT_URL, { method: "POST", body: data });
    if (!res.ok) throw new Error("Bad response: " + res.status);

    const attending = form.attending.value === "Yes";
    thankYouText.textContent = attending
      ? "We can't wait to celebrate with you!"
      : "We're sorry you can't make it — thank you for letting us know.";
    form.classList.add("hidden");
    if (formIntro) formIntro.classList.add("hidden");
    thankYou.classList.remove("hidden");
  } catch (err) {
    formError.textContent =
      "Something went wrong sending your RSVP. Please try again, or contact us directly.";
    formError.classList.remove("hidden");
    submitBtn.disabled = false;
    submitBtn.textContent = "Send RSVP";
  }
});
