const path = require('path')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('superagent')

app.set('port', (process.env.PORT || 5000))

app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, '/public')))

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'A7760FD8-7683-4262-88E0-C0F379C1C1D6') {
    res.send(req.query['hub.challenge'])
  } else {
    res.send('Error, wrong validation token')
  }
})

const sendTextMessage = (sender, text) => {
  request
    .post('https://graph.facebook.com/v2.6/me/messages')
    .query({ access_token: process.env.PAGE_ACCESS_TOKEN })
    .send({
      recipient: { id: sender },
      message: { text: text }
    })
    .end(function(error, response){
      if (error) {
        console.log('Error sending message: ', error);
      } else if (response.body.error) {
        console.log('Error: ', response.body.error);
      }
    })
}

app.post('/webhook/', (req, res) => {
  messaging_events = req.body.entry[0].messaging
  messaging_events.map( event => {
    sender = event.sender.id
    if (event.message && event.message.text) {
      text = event.message.text
      // Handle a text message from this sender
      sendTextMessage(sender, `Text received: ${text.substring(0, 200)}`)
    }
  })
  res.sendStatus(200)
})

app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'))
})
