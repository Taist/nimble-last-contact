
app = require './app'
state = require './state'
require './actions'

contactsCursor = state.select ['contacts']

proxy = require './helpers/xmlHttpProxy'

extractNimbleAuthTokenFromRequest = ->
  proxy.onRequestFinish responseHandler: (request) ->
    url = request.responseURL
    tokenMatches = url.match /\/api\/sessions\/([0-9abcdef-]{36})\?/
    if tokenMatches?
      app.options.nimbleToken = tokenMatches[1]

findParent = (element, selector) ->
  while parentNode = element.parentNode
    return parentNode if parentNode.matches selector
    element = parentNode

  return null

DOMObserver = require './helpers/domObserver'
elementObserver = new DOMObserver()

showLastContactedPerson = (contactId, userId) ->
  #find container
  selector = ".ContactsGrid [__gwt_row] .contact-name[href$=\"#{contactId}\"]"
  elementObserver.waitElement selector, (contactLink) ->
    contactBlock = findParent contactLink, '[__gwt_row]'

    if contactBlock
      #find selector for appropriate row
      attrValue = contactBlock.getAttribute '__gwt_row'
      selector = ".ContactsGrid [__gwt_row=\"#{attrValue}\"] td.last-contacted"
      lastContactContainer = document.querySelector selector

      #find last contact container
      if lastContactContainer
        lastContactContainer.style.paddingLeft = '12px'
        div = document.createElement 'div'
        div.style.color = 'black'
        lastContactContainer.appendChild div

        #get user form the state
        userCursor = state.select ['users', userId]
        user = userCursor.get()

        if user
          div.innerText = user.name or ''
        else
          userCursor.on 'update', (event) ->
            userCursor.off 'update'
            div.innerText = event.data.data.name or ''

waitingForContactsRequest = ->
  proxy.onRequestFinish responseHandler: (request) ->
    url = request.responseURL
    if url.match /\/api(\/.+)?\/contacts\/list\?/
      try
        result = JSON.parse request.responseText
      catch error
        return

      result.resources?.forEach (contact) ->
        {id, last_contacted} = contact
        if(last_contacted?.user_id?)
          contactsCursor.update "#{id}": last_contacted: $set: last_contacted
          showLastContactedPerson id, last_contacted.user_id

addonEntry =
  start: (_taistApi, entryPoint) ->
    window._app = app
    app.init _taistApi

    extractNimbleAuthTokenFromRequest()

    waitingForContactsRequest()

    _taistApi.log 'Addon started'

module.exports = addonEntry
