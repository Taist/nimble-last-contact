app = null

sendNimbleRequest = (path) ->
  if app.options.nimbleToken
    new Promise (resolve, reject) ->
      $.ajax
        url: path
        dataType: "json"
        headers:
          Authorization: "Nimble token=\"#{app.options.nimbleToken}\""
      .then(
        (result) -> resolve result
        (error) -> reject error
      )

  else
    new Promise (resolve) ->
      setTimeout (-> resolve sendNimbleRequest path), 500

nimbleAPI =
  getDealIdFromUrl: ->
    matches = location.hash.match /deals\/[^?]+\?id=([0-9a-f]{24})/
    if matches then matches[1] else null

  getDealInfo: () ->
    if dealId = nimbleAPI.getDealIdFromUrl()
      sendNimbleRequest "/api/deals/#{dealId}"

  getContactById: (contactId) ->
    sendNimbleRequest "/api/v1/contacts/detail/?id=#{contactId}"

  getUserById: (userId) ->
    sendNimbleRequest "/api/users/#{userId}"

module.exports =
  init: (_app, propertyName) ->
    app = _app
    _app[propertyName] = nimbleAPI
