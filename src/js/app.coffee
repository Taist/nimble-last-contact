appData = {}

wrapByPromise = (object, method) ->
  (args...) ->
    return new Promise (resolve, reject) ->
      args.push (error, result) -> if error then reject error else resolve result
      object[method].apply object, args

wrapTaistAPI = (api) ->
  app.exapi.setUserData = wrapByPromise api.userData, 'set'
  app.exapi.setUserData = wrapByPromise api.userData, 'get'

  app.exapi.setCompanyData = wrapByPromise api.companyData, 'set'
  app.exapi.getCompanyData = wrapByPromise api.companyData, 'get'

  app.exapi.setPartOfCompanyData = wrapByPromise api.companyData, 'setPart'
  app.exapi.getPartOfCompanyData = wrapByPromise api.companyData, 'getPart'

  app.exapi.updateCompanyData = (key, newData) ->
    app.exapi.getCompanyData key

    .then (storedData) ->
      updatedData = {}
      Object.assign updatedData, storedData, newData

      Promise.all([
        updatedData,
        app.exapi.setCompanyData key, updatedData
      ])

    .then (data) ->
      data[0]

app =
  api: null
  exapi: {}

  options:
    nimbleToken: null

  init: (api) ->
    app.api = api
    wrapTaistAPI(api)

    require('./nimbleApi').init app, 'nimbleAPI'

  actions: {}

module.exports = app
