var bnticketsModule = angular.module('bntickets', []).
  config(
    function($routeProvider) {
      $routeProvider.
        when('/', {controller:TicketsController, templateUrl:'frontpage.html'}).
        when('/details/:ticketID', {controller:TicketDetailsController, templateUrl:'details.html'}).
        otherwise({redirectTo:'/'});
    }
  );

// To communicate between the controllers, using pubsub-pattern: http://jsfiddle.net/simpulton/XqDxG/
// Also refer to http://stackoverflow.com/questions/11252780/whats-the-correct-way-to-communicate-between-controllers-in-angularjs
bnticketsModule.factory('pubsubService', function($rootScope) {
  var sharedService = {};
    
  sharedService.message = {};

  sharedService.prepForBroadcast = function(msgType, msg) {
    this.message = msg;
    switch(msgType) {
      case "log": this.broadcastLogItem();
                  break;
    }
  };

  sharedService.broadcastLogItem = function() {
    $rootScope.$broadcast('log');
  };

  return sharedService;
});

// Purpose is to write log-entry about each action
function LogController($scope, pubsubService) {
  $scope.myLogEntries = [];
  var logRef = new Firebase('https://bnfirebase.firebaseio.com/log');

  logQuery = logRef.limit(5); // only 5 last log-entries

  logQuery.on('child_added', function(snapshot) {
    var value = snapshot.val();
    value.id = snapshot.name();
    $scope.myLogEntries.push( value );
    $scope.safeApply();
  });

  $scope.$on('log', function() {
    console.log(pubsubService.message);
    $scope.addLogEntry(pubsubService.message.userID,
                       pubsubService.message.ticketID,
                       pubsubService.message.title,
                       pubsubService.message.action);
  });  

  $scope.getLogEntries = function() {
    return $scope.myLogEntries;
  }

  $scope.addLogEntry = function(userID, ticketID, title, action) {
    var timestamp = (new Date()).toGMTString();

    logRef.push({userID: userID,
                ticketID: ticketID,
                title: title,
                action: action,
                timestamp: timestamp
                });
  }

  $scope.safeApply = function(fn) {
    var phase = this.$root.$$phase;
    if (phase == '$apply' || phase == '$digest') {
      if (fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };
}


function TicketsController($scope, pubsubService) {
  $scope.myTickets = [];
  var ticketsRef = new Firebase('https://bnfirebase.firebaseio.com/tickets');

  ticketsRef.on('child_added', function(snapshot) {
    var value = snapshot.val();
    value.id = snapshot.name();
    $scope.myTickets.push( value );
// BUGBUG: nyt valittaa tästäkin. Tätä ennen tehty refaktorointi, jossa näkymät
//         includataan ja niille annetaan kontrolleri. Se jotenkin sotkee tämän...
//    $scope.safeApply(); // for async callback, the angular bindings must be manually triggered, and safeApply checks that angular's internal state is ok for this
    // Clear the input forms:
    $('#newTicketTitle').val('');
    $('#newTicketDescription').val('');
    $('#newTicketRequester').val('');
  });

  ticketsRef.on('child_removed', function(snapshot) {
    var value = snapshot.val();
    value.id = snapshot.name();
    // remove the removed ticket from myTickets:
    var index = 0;
    var removeIndex = -1;
    $scope.myTickets.forEach(function(ticket) {
      if (ticket.id === value.id) {
        removeIndex = index;
      }
      index += 1;
    })

    if (removeIndex > -1) {
      $scope.myTickets.splice(removeIndex, 1);
    }
    $scope.safeApply(); // for async callback, the angular bindings must be manually triggered, and safeApply checks that angular's internal state is ok for this
  });

  ticketsRef.on('child_changed', function(snapshot) {
    var value = snapshot.val();
    value.id = snapshot.name();
    var ticketIndex = $scope.getTicketIndexByID(snapshot.name());
    $scope.updateTicketIndex(ticketIndex, value);
    $scope.safeApply();
  });

  $scope.getTickets = function() {
    return $scope.myTickets;
  }

  $scope.getTicketByID = function(ticketID) {
    var ticket = _.find($scope.myTickets, function(ticket) {
      return ticket.id === ticketID;
    })
    return ticket;
  }

  $scope.getTicketIndexByID = function(ticketID) {
    var ticketIndex = -1;
    var index = 0;
    _.each($scope.myTickets, function(ticket) {
      if ( ticket.id === ticketID ) {
        ticketIndex = index;
      }
      index += 1;
    })
    return ticketIndex;
  }

  $scope.updateTicketIndex = function(index, updatedTicket) {
    if (index > -1 && $scope.myTickets.length >= index) {
      $scope.myTickets[index] = updatedTicket;
    }
  }

  $scope.addTicket = function() {
    var title = $('#newTicketTitle').val()
      , description = $('#newTicketDescription').val()
      , requester = $('#newTicketRequester').val()
      , timestamp = (new Date()).toGMTString();

    ticketsRef.push({requester: requester,
                     title: title,
                     description: description,
                     createdTimestamp: timestamp,
                     status: "open"
                    });
    pubsubService.prepForBroadcast('log', {userID: "TP", ticketID: '', action: 'ticket created', title: title});
  }

  $scope.handleAction = function() {
    var actionID = $('#actionSelect').val();
    switch(actionID) {
      case "0": $scope.deleteSelectedTickets();
                break;
      case "1": $scope.toggleSelectedTicketsStatus();
                break;
    }
  }

  $scope.deleteSelectedTickets = function() {
    var self = this;
    var selectedTickets = $('[type=checkbox]').filter(':checked');
    if (selectedTickets.length > 0) {
      if ( confirm("Delete selected tickets?") ) {
        var selectedTicketIDs = selectedTickets.each(function(i, sel) {
          console.log("Delete: " + sel.id)
          var ticket = $scope.getTicketByID(sel.id);
          ticketsRef.child("/" + ticket.id).remove(function(err) {
            pubsubService.prepForBroadcast('log', {userID: "TP", ticketID: ticket.id, action: 'ticket deleted', title: ticket.title});
          })
        })
      } else {
        alert("Canceled delete")
      }
    }
  }

  $scope.toggleSelectedTicketsStatus = function() {
    var self = this;

    var selectedTickets = $('[type=checkbox]').filter(':checked');
    var selectedTicketIDs = selectedTickets.each(function(i, sel) {
      var ticket = $scope.getTicketByID(sel.id);

      switch(ticket.status.toLowerCase()) {
        case "open":
          ticketsRef.child("/" + sel.id).update({status: "closed"});
          pubsubService.prepForBroadcast('log', {userID: "TP", ticketID: sel.id, action: 'ticket closed', title: ticket.title});
          break;
        case "closed":
          ticketsRef.child("/" + sel.id).update({status: "open"});
          pubsubService.prepForBroadcast('log', {userID: "TP", ticketID: sel.id, action: 'ticket re-opened', title: ticket.title});
          break;
      }
    })
  }

  $scope.safeApply = function(fn) {
    var phase = this.$root.$$phase;
    if (phase == '$apply' || phase == '$digest') {
      if (fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };
}

function TicketDetailsController($scope, pubsubService, $routeParams) {
  var ticketID = $routeParams.ticketID;
  var ticketRef = new Firebase('https://bnfirebase.firebaseio.com/tickets/' + ticketID);

  console.log("Reading ticket: " + ticketID);

  $scope.ticket = null;

  ticketRef.on('value', function(snapshot) {
    $scope.ticket = snapshot.val();
    $scope.ticket.id = snapshot.name();
    console.log($scope.ticket);
    //$scope.safeApply();
  });

  ticketRef.on('child_changed', function(snapshot) {
    $scope.ticket = snapshot.val();
    $scope.ticket.id = snapshot.name();
    console.log('Changes saves.');
    alert("Changes saved");
  });

  // Saves the edited ticket
  $scope.save = function() {
    var title = $("#title").val();
    var description = $("#description").val();
    console.log('Saving: ' + title);
    ticketRef.update({title: title, description: description});
  }

  $scope.safeApply = function(fn) {
    var phase = this.$root.$$phase;
    if (phase == '$apply' || phase == '$digest') {
      if (fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };
}

LogController.$inject = ['$scope', 'pubsubService'];
TicketsController.$inject = ['$scope', 'pubsubService'];
