var nock = require('nock');
var Helper = require('hubot-test-helper');

var pullReview = require('../index');

var driver = require('./driver');
var githubMock = driver.githubMock;
var config = driver.config;
var helper = new Helper('../index.js');

describe('pull-review', function () {
  afterEach(function () {
    nock.cleanAll();
  });

  it('works with no assignees', function () {
    githubMock({
      'config': config
    });
    return pullReview({
      'pullRequestURL': 'https://github.com/OWNER/REPO/pull/1'
    });
  });

  it('works with an assignee', function () {
    githubMock({
      'assignee': { 'login': 'charlie' },
      'config': config
    });
    return pullReview({
      'pullRequestURL': 'https://github.com/OWNER/REPO/pull/1',
      'retryReview': true
    });
  });

  it('filters out committers', function () {
    githubMock({
      'config': config,
      'commits': [
        {
          'author': {
            'login': 'bob'
          }
        }
      ]
    });
    return pullReview({
      'pullRequestURL': 'https://github.com/OWNER/REPO/pull/1'
    })
      .then(function (actions) {
        actions.should.have.lengthOf(2);
        actions[0].payload.assignees.should.not.include('bob');
      });
  });

  it('fails with invalid arguments', function () {
    (function () { pullReview(); }).should.throw('Invalid input: either a review request or a Hubot reference must be provided');
  });

  describe('with Slack notifications', function () {
    it('works with Markdown', function () {
      githubMock({
        'config': config
      });

      var message;

      return pullReview({
        'pullRequestURL': 'https://github.com/OWNER/REPO/pull/1',
        'chatRoom': 'test',
        'chatChannel': 'hubot:slack',
        'isChat': true,
        'notifyFn': function (m) {
          message = m;
        }
      })
        .then(function () {
          message.text.should.equal('@bsmith: please review this pull request');
          message.attachments.should.have.lengthOf(1);
          var attachment = message.attachments[0];
          attachment.title.should.equal('OWNER/REPO: Hello world');
          attachment.title_link.should.equal('https://github.com/OWNER/REPO/pull/1');
          attachment.text.should.equal('*Description*\n\n The quick brown fox jumps over the lazy dog. Check out <https://github.com|GitHub.com>');
          attachment.fallback.should.equal('Hello world by alice: https://github.com/OWNER/REPO/pull/1');
        });
    });

    it('works with images', function (done) {
      githubMock({
        'config': config
      });

      pullReview({
        'pullRequestURL': 'https://github.com/OWNER/REPO/pull/2',
        'chatRoom': 'test',
        'chatChannel': 'hubot:slack',
        'isChat': true,
        'notifyFn': function (message) {
          message.attachments.should.have.lengthOf(1);
          var attachment = message.attachments[0];
          attachment.image_url.should.equal('https://example.com/image.png');
          done();
        }
      });
    });
  });

  describe('using Hubot', function () {
    var room;

    beforeEach(function () {
      githubMock({
        'config': config
      });

      room = helper.createRoom({
        'name': 'test'
      });
    });

    afterEach(function () {
      nock.cleanAll();
      return room.destroy();
    });

    it('works', function (done) {
      room.user.say('alice', 'review https://github.com/OWNER/REPO/pull/1 please')
        .then(function () {
          setTimeout(function () {
            room.messages.should.have.lengthOf(2);
            room.messages[1][0].should.equal('hubot');
            room.messages[1][1].should.equal('@bob: please review this pull request - https://github.com/OWNER/REPO/pull/1');
            done();
          }, 100);
        });
    });
  });
});
