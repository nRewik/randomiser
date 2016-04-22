'use strict'

const path = require('path')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('superagent')
const chance = require('chance').Chance()

app.set('port', (process.env.PORT || 5000))

app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, '/public')))

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
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
  const messaging_events = req.body.entry[0].messaging
  messaging_events.map( event => {
    const sender = event.sender.id
    if (event.message && event.message.text) {
      const text = event.message.text

      // Handle a text message from this sender
      const random = (command) => {
        if ( typeof chance[command] === 'function' ) {
          return chance[command]()
        }
        return null
      }

      const tryFallBackCommand = () => {
        const result = random(text.toLowerCase())
        if (result) {
          sendTextMessage(sender, `${result}`)
        } else {
          const failedSentences = [
            `I don't understand that.`,
            `I cannot do that, but I can roll dices all day.`,
            `That is not within my capabilities.`
          ]
          sendTextMessage(sender, chance.pickone(failedSentences))
        }
      }

      request
        .get('https://api.projectoxford.ai/luis/v1/application')
        .query({
          id: process.env.LUIS_APP_ID,
          'subscription-key': process.env.LUIS_APP_SUBSCRIPTION_KEY,
          q: text
        })
        .end(function(error, response){
          if (error) {
            return console.log(`Error LUIS: ${error}`);
          }

          const resultIntent = response.body.intents[0]
          console.log(JSON.stringify(resultIntent, null, 2))
          if ( resultIntent.intent === 'RANDOM' && resultIntent.score > 0.5 ) {

            // Extract parameters to dict
            let parameters = {}
            resultIntent.actions[0].parameters.forEach(parameter => {
              if (parameter.value) {
                parameters[parameter.name] = parameter.value[0].entity
              }
            })

            // Check if it is a support random type
            // Now, we support only number type
            const supportRandomType = (parameters.type === 'number' || parameters.type === 'numbers')
            if (!supportRandomType) {
              return tryFallBackCommand()
            }

            const amount = Number(parameters.amount) ? Number(parameters.amount) : 1

            // Parse args
            let args = {}
            if (parameters.min) { args.min = Number(parameters.min) }
            if (parameters.max) { args.max = Number(parameters.max) }

            // Handle args exception
            if ((args.min && parameters.min) < 0 || (args.max && parameters.max < 0)) {
              return sendTextMessage(sender, `Number should be greater than or equal zero.`)
            }
            if (args.min && args.max && args.min > args.max) {
              return sendTextMessage(sender, `Lowerbound should be less than or equal upperbound.`)
            }

            // Give the answer
            let responseText = ''
            for (let i=1; i<=amount; i++) {
              const randomResult = chance.natural(args)
              const answer = amount == 1 ? `${randomResult}` : `${i}) ${randomResult}`
              responseText += answer + '\n'
            }
            sendTextMessage(sender, responseText)
          } else {
            tryFallBackCommand()
          }
        })
        // end request

    }
  })
  res.sendStatus(200)
})

app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'))
})
