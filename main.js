var app = angular.module('codecraft', [
    'ngResource',
    'infinite-scroll',
    'angularSpinner',
    'jcs-autoValidate',
    'angular-ladda',
    'mgcrea.ngStrap',
    'toaster',
    'ngAnimate',
    'ui.router'
]);


app.config(function ($stateProvider, $urlRouterProvider) {
    $stateProvider
        //when referencing list use the following configuration
        .state('list', {
            url: "/",
            templateUrl: 'templates/list.html',
            controller: 'PersonListController'  //define the state's controller
        })
        .state('edit', {
            url: "/edit/:email",
            templateUrl: 'templates/edit.html',
            controller: 'PersonDetailController'
        })

        .state('create', {
            url: "/create",
            templateUrl: 'templates/edit.html',
            controller: 'PersonCreateController'
        });
    $urlRouterProvider.otherwise('/');
});


/*
 called when application bootstraps itself
 allows you to set default/pre-configured settings for values
 */
app.config(function ($httpProvider, $resourceProvider, laddaProvider) {
    $httpProvider.defaults.headers.common['Authorization'] = 'Token 12896c4be1892acd2879e22c833e745839317913';
    $resourceProvider.defaults.stripTrailingSlashes = false; // b/c of api must be used
    laddaProvider.setOption({
        style: 'expand-right'
    });

});


app.factory("Contact", function ($resource) {
    /*
     :id is optional
     if want to get a specific contact we pass the id

     if it finds an id in the resource then use that id as a parameter
     */
    return $resource("https://codecraftpro.com/api/samples/v1/contact/:id/", {id: '@id'}, {
        update: {
            method: 'PUT'
        }
    });
});

app.filter('defaultImage', function () {
    return function (input, param) {
        if (!input) {
            return param;
        }
        return input;
    };
});

app.controller('PersonCreateController', function ($scope, $state, ContactService) {
    $scope.contacts = ContactService;

    $scope.mode = "Create";

    $scope.save = function () {
        console.log("createContact");
        //uses promise as call back to determine when to close modal
        $scope.contacts.createContact($scope.contacts.selectedPerson)
            .then(function () {
                $state.go("list");
            });
    };

});

app.controller('PersonDetailController', function ($scope, ContactService, $stateParams, $state) {

    console.log($stateParams);

    $scope.mode = "Edit";

    $scope.contacts = ContactService;

    $scope.contacts.selectedPerson = $scope.contacts.getPerson($stateParams.email);

    $scope.save = function () {
        $scope.contacts.updateContact($scope.contacts.selectedPerson).then(function () {
            $state.go('list');
        });

    };
    //uses promise as a callback to determine when function is complete
    $scope.remove = function () {
        $scope.contacts.removeContact($scope.contacts.selectedPerson).then(function () {
            $state.go('list');
        });
    };
});

app.controller('PersonListController', function ($scope, ContactService, $modal) {
    $scope.search = "";
    $scope.order = "email";
    $scope.contacts = ContactService;

    $scope.loadMore = function () {
        console.log("Load More!!!");
        $scope.contacts.loadMore();
    };

    $scope.showCreateModal = function () {

        $scope.contacts.selectedPerson = {};    //personis no longer being selected
        $scope.createModal = $modal({
            scope: $scope,
            template: 'templates/modal.create.tpl.html',
            show: true
        })
    };


});
/*
 q service is used to create promises you can return from functions
 */
app.service('ContactService', function (Contact, $q, toaster, $rootScope) {


    var self = {
        'getPerson': function (email) {
            console.log(email);
            for (var i = 0; i < self.persons.length; i++) {
                var obj = self.persons[i];
                console.log(obj);
                if (obj.email == email) {
                    return obj;
                }
            }
        },
        'page': 1,
        'hasMore': true, //assume always more
        'isLoading': false,
        'selectedPerson': null,
        'persons': [],
        'search': null,
        'ordering': 'name',
        'doSearch': function () {
            self.hasMore = true;
            self.page = 1;
            self.persons = [];  //empty array so that we have a blank page to add to
            self.loadContacts();
        },
        'doOrder': function () {
            self.hasMore = true;
            self.page = 1;
            self.persons = [];  //empty array so that we have a blank page to add to
            self.loadContacts();
        },
        'loadContacts': function () {

            //load new data if there is more to load and there isn't data alreading being loaded
            if (self.hasMore && !self.isLoading) {
                //essentially acting as a binary semaphore
                self.isLoading = true;

                /*
                 paramaters to pass to the api query
                 page - page of the data
                 search - string to look for in the data
                 ordering - sets the order of the data that will be recieved
                 */
                var params = {
                    'page': self.page,
                    'search': self.search,
                    'ordering': self.ordering
                };

                /*
                 get is proprietary to the api
                 params - is the values taken by the api to determine the data that you are requesting
                 */
                Contact.get(params, function (data) {
                    console.log(data);
                    //loop through the api response
                    angular.forEach(data.results, function (person) {


                        self.persons.push(new Contact(person));
                    });

                    //is there more data to load?
                    if (!data.next) {
                        self.hasMore = false;
                    }

                    //unlock resource
                    self.isLoading = false;
                });

            }


        },
        'loadMore': function () {
            if (self.hasMore && !self.isLoading) {
                self.page++;
                self.loadContacts();
            }
        },
        'updateContact': function (person) {
            var d = $q.defer();
            self.isSaving = true;

            //$update is a built in function
            person.$update().then(function () {
                self.isSaving = false;
                toaster.pop('success', 'Updated ' + person.name);
                d.resolve();
            });
            return d.promise;
        },
        'removeContact': function (person) {
            var d = $q.defer();
            self.isDeleting = true;
            //$remove is a built in function
            person.$remove().then(function () {
                self.isDeleting = false;
                var index = self.persons.indexOf(person);
                self.persons.splice(index, 1);
                self.selectedPerson = null;
                toaster.pop('success', 'Removed ' + person.name);
                d.resolve();
            });
            return d.promise;
        },
        'createContact': function (person) {
            var d = $q.defer();
            self.isSaving = true;
            //$update is a built in function
            Contact.save(person).$promise.then(function () {
                self.isSaving = false;
                self.selectedPerson = null;
                self.hasMore = true;
                self.page = 1;
                self.persons = [];
                self.loadContacts();
                toaster.pop('success', 'Created ' + person.name);
                d.resolve();    //callback
            });
            //returns whether or not promise has been resolved
            return d.promise;
        },
        'watchFilters': function () {
            $rootScope.$watch(function () {
                return self.search;
            }, function (newVal) {
                if (angular.isDefined(newVal)) {
                    self.doSearch();
                }
            });

            $rootScope.$watch(function () {
                return self.ordering;
            }, function (newVal) {
                if (angular.isDefined(newVal)) {
                    self.doOrder();
                }
            });
        }

    };

    self.loadContacts();
    self.watchFilters();

    return self;
});