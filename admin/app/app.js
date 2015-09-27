var app = angular.module("app", []);

app.controller("mainCtrl", ['$scope', '$http', function($scope, $http){
	$http.get('/givemeall').then(function(res){
		$scope.db = res.data;
	});
}]);
