app = require './app'
state = require './state'

promises = {}

state.on 'get', (event) ->
  {path, data} = event.data

  if !data and path[0] is 'users'
    userId = path[1]

    unless promises[userId]
      console.log 'get userinfo from the server ' + userId
      promises[userId] = app.nimbleAPI.getUserById userId

    promises[userId].then (userInfo) ->
      state.set path, name: "#{userInfo.first_name} #{userInfo.last_name}"
