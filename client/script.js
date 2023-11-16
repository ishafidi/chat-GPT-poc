import bot from './assets/bot.svg';
import user from './assets/user.svg';

const form = document.querySelector('form');
const chatContainer = document.querySelector('#chat_container');
const startVoiceButton = document.querySelector('#start_voice');
const stopReadingButton = document.querySelector('#stop_reading');

let recognition;
let utterance;
let loadInterval;

function loader(element) {
  element.textContent = '';

  loadInterval = setInterval(() => {
    element.textContent += '.';
    if (element.textContent === '....') {
      element.textContent = '';
    }
  }, 300);
}

function typeText(element, text) {
  let index = 0;

  let interval = setInterval(() => {
    if (index < text.length) {
      element.innerHTML += text.charAt(index);
      speakText(text.charAt(index));
      index++;
    } else {
      clearInterval(interval);
    }
  }, 20);
}

function generateUniqueId() {
  const timestamp = Date.now();
  const randomNumber = Math.random();
  const hexadecimalString = randomNumber.toString(16);

  return `id-${timestamp}-${hexadecimalString}`;
}

function chatStripe(isAi, value, uniqueId) {
  return `
    <div class="wrapper ${isAi && 'ai'}">
        <div class="chat">
            <div class="profile">
                <img 
                  src=${isAi ? bot : user} 
                  alt="${isAi ? 'bot' : 'user'}" 
                />
            </div>
            <div class="message" id=${uniqueId}>${value}</div>
        </div>
    </div>
  `;
}

function speakText(text) {
  const synth = window.speechSynthesis;
  utterance = new SpeechSynthesisUtterance(text);
  synth.speak(utterance);
}

function stopRecognition() {
  if (recognition) {
    recognition.stop();
  }
}

function stopSpeechSynthesis() {
  window.speechSynthesis.cancel();
}

// Function to start voice input
async function startVoiceInput() {
  console.log('Starting voice input...');
  try {
    recognition = new (webkitSpeechRecognition || SpeechRecognition)();
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      console.log('Voice recognition result:', event.results[0][0].transcript);
      const speechToText = event.results[0][0].transcript;
      form.querySelector('textarea[name="prompt"]').value = speechToText;

      // Trigger form submission with voice input
      form.dispatchEvent(new Event('submit'));
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
    };

    recognition.onend = () => {
      console.log('Voice recognition ended.');
      stopSpeechSynthesis();
    };

    recognition.start();
  } catch (error) {
    console.error('Error initializing voice recognition:', error);
  }
}

startVoiceButton.addEventListener('click', startVoiceInput);

stopReadingButton.addEventListener('click', () => {
  // Stop speech synthesis and recognition
  stopSpeechSynthesis();
  stopRecognition();
});

const handleSubmit = async (e) => {
  e.preventDefault();

  const data = new FormData(form);

  // user's chatstripe
  chatContainer.innerHTML += chatStripe(false, data.get('prompt'));

  // to clear the textarea input
  form.reset();

  // bot's chatstripe
  const uniqueId = generateUniqueId();
  chatContainer.innerHTML += chatStripe(true, ' ', uniqueId);

  // to focus scroll to the bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // specific message div
  const messageDiv = document.getElementById(uniqueId);

  // messageDiv.innerHTML = "..."
  loader(messageDiv);

  try {
    const response = await fetch('http://localhost:5000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: data.get('prompt'),
      }),
    });

    clearInterval(loadInterval);
    messageDiv.innerHTML = ' ';

    if (response.ok) {
      const responseData = await response.json();
      const parsedData = responseData.bot.trim();

      // bot's chatstripe
      const uniqueId = generateUniqueId();
      chatContainer.innerHTML += chatStripe(true, ' ', uniqueId);
      // to focus scroll to the bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;

      // specific message div
      const messageDiv = document.getElementById(uniqueId);

      // messageDiv.innerHTML = "..."
      loader(messageDiv);

      // Speak the response
      speakText(parsedData);

      // Update the messageDiv with the parsedData
      typeText(messageDiv, parsedData);
    } else {
      // Handle errors
      const err = await response.text();
      // Log the error
      console.error('API Error:', err);
      // Display error message in the messageDiv
      messageDiv.innerHTML = 'Something went wrong: ' + err;
      alert(err);
    }
  } catch (error) {
    // Log any unexpected errors
    console.error('Unexpected error:', error);
  }
};

form.addEventListener('submit', handleSubmit);
form.addEventListener('keyup', (e) => {
  if (e.keyCode === 13) {
    handleSubmit(e);
  }
});
