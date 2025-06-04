require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const cron = require('node-cron');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const deviceId = process.env.DEVICE_ID || 'BSI12345';
const topic = `IR/${deviceId}/command`;
const mqttClient = mqtt.connect('mqtt://35.154.62.193');

let isWorkingDay = true;

app.use(express.static('public')); // Serves index.html and any CSS/JS
app.use(express.json());

// MQTT connection
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});

// API route to send commands
app.post('/send', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).send('Missing command');

  if (command.toLowerCase() === 'noworkingday') {
    isWorkingDay = false;
    console.log('Marked today as non-working day');
    return res.send('Marked today as a non-working day.');
  }

  mqttClient.publish(topic, command.toLowerCase(), () => {
    console.log(`Published '${command}' to ${topic}`);
    res.send(`Command '${command}' sent`);
  });
});

// Reset at midnight
cron.schedule('0 0 * * *', () => {
  isWorkingDay = true;
});

// ON every 20 mins from 10:00–18:40, Mon–Sat
cron.schedule('*/20 10-18 * * 1-6', () => {
  if (!isWorkingDay) {
    console.log('Skipped due to non-working day');
    return;
  }

  const now = new Date();
  const minutes = now.getMinutes();
  if ([0, 20, 40].includes(minutes)) {
    console.log('Scheduled ON (20-min cycle)');
    mqttClient.publish(topic, 'on');
  }
});

// OFF at 7 PM
cron.schedule('0 19 * * 1-6', () => {
  if (!isWorkingDay) {
    console.log('Skipped OFF due to non-working day');
    return;
  }

  console.log('Scheduled OFF at 7:00 PM');
  mqttClient.publish(topic, 'off');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
module.exports = app;