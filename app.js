var bnticketsModule = angular.module('bntickets', []).
  config(
    function($routeProvider) {
      $routeProvider.
        when('/', {controller:TicketsController, templateUrl:'list.html'}).
        otherwise({redirectTo:'/'});
    }
  );

function TicketsController($scope) {
  $scope.myTickets = [];
  var ticketsRef = new Firebase('https://bnfirebase.firebaseio.com/tickets');

  ticketsRef.on('child_added', function(snapshot) {
    var value = snapshot.val();
    value.id = snapshot.name();
    $scope.myTickets.push( value );
    $scope.safeApply(); // for async callback, the angular bindings must be manually triggered, and safeApply checks that angular's internal state is ok for this
    console.log('Got tickets:');
    console.log($scope.myTickets);
  });

  $scope.getTickets = function() {
    return $scope.myTickets;
  }

  $scope.addTicket = function() {
    console.log('Adding ticket');
    var title = $('#newTicketTitle').val();
    var description = $('#newTicketDescription').val();
    var requester = $('#newTicketRequester').val();
    var timestamp = (new Date()).toGMTString();
    ticketsRef.push({requester: requester,
                     title: title,
                     description: description,
                     createdTimestamp: timestamp
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
