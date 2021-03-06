const expect = require('chai').expect
const sinon = require('sinon')
const App = require('../app')
const supertest = require('supertest')

const Services = require('../services/services')
const Datasource = require('../services/datasource')

let request
let ds

afterEach(() => {
  sinon.restore()
})

describe('GET /suggestions', () => {
  before(async () => {
    ds = new Datasource()
    await ds.initialize()
    request = supertest(App(ds))
  })

  describe('with wrong latitude & longitude params', () => {
    let response

    before(done => {
      request
        .get('/suggestions?q=Montreal&latitude=200&longitude=invalid')
        .end((err, res) => {
          response = res
          response.json = JSON.parse(res.text)
          done(err)
        })
    })

    it('returns a 400', () => {
      expect(response.statusCode).to.equal(400)
    })

    it('returns an error message', () => {
      expect(response.json.error).to.contain('latitude')
      expect(response.json.error).to.contain('longitude')
    })
  })

  describe('with a non-existent city', () => {
    let response

    before(done => {
      request
        .get('/suggestions?q=SomeRandomCityInTheMiddleOfNowhere')
        .end((err, res) => {
          response = res
          response.json = JSON.parse(res.text)
          done(err)
        })
    })

    it('returns a 404', () => {
      expect(response.statusCode).to.equal(404)
    })

    it('returns an empty array of suggestions', () => {
      expect(response.json.suggestions).to.be.instanceof(Array)
      expect(response.json.suggestions).to.have.length(0)
    })
  })

  describe('with a valid city', () => {
    let response

    before((done) => {
      request
        .get('/suggestions?q=Montreal')
        .end((err, res) => {
          response = res
          response.json = JSON.parse(res.text)
          done(err)
        })
    })

    it('returns a 200', () => {
      expect(response.statusCode).to.equal(200)
    })

    it('returns an array of suggestions', () => {
      expect(response.json.suggestions).to.be.instanceof(Array)
      expect(response.json.suggestions).to.have.length.above(0)
    })

    describe('Validate the shape of the data being returned', () => {
      it('contains latitudes and longitudes', () => {
        expect(response.json.suggestions).to.satisfy((suggestions) => {
          return suggestions.every((suggestion) => {
            return suggestion.latitude && suggestion.longitude
          })
        })
      })

      it('contains scores', () => {
        expect(response.json.suggestions).to.satisfy((suggestions) => {
          return suggestions.every((suggestion) => {
            return suggestion.score >= 0 && suggestion.score <= 1
          })
        })
      })
    })

    it('contains a match', () => {
      expect(response.json.suggestions).to.satisfy((suggestions) => {
        return suggestions.some((suggestion) => {
          return /Montréal/i.test(suggestion.name)
        })
      })
    })
  })

  describe('internal error handling', () => {
    before(() => {
      sinon.replace(Services.prototype, 'getSuggestions', sinon.fake.throws(new Error('fake exception')))
    })

    describe('valid request', () => {
      let response

      before(done => {
        request
          .get('/suggestions?q=Montreal')
          .end((err, res) => {
            response = res
            done(err)
          })
      })

      it('returns a 500', () => {
        expect(response.statusCode).to.equal(500)
      })

      it('no information is leaked', () => {
        expect(response.text.length).to.equal(0)
      })
    })
  })

})
