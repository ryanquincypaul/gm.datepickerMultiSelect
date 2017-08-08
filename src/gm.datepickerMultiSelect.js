/*
The MIT License (MIT)

Copyright (c) 2014 Gregory McGee

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Date.parse is not a safe way to parse dates and broke the control for me on Chrome in the EDT timezone.
// It would store the date prior to the date selected due to the funky parsing.
// parse a date in yyyy-mm-dd format
function parseDate(input) {
  var parts = input.split('-');
  // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
  return new Date(parts[0], parts[1]-1, parts[2]); // Note: months are 0-based
}

(function (angular) {
	'use strict';
	
	angular.module('gm.datepickerMultiSelect', ['ui.bootstrap'])
	.filter('gmISODate', function() {
	  return function(date) {
	    return date.toISOString().split("T")[0];
	  }
	})
	.config(['$provide', '$injector', function ($provide, $injector) {
	  
	  var useUTC = false;

		// extending datepicker (access to attributes and app scope through $parent)
		var datepickerDelegate = function ($delegate, $filter) {
			var directive = $delegate[0];

			// Override compile
			var link = directive.link;

			directive.compile = function () {
				return function (scope, element, attrs, ctrls) {
					link.apply(this, arguments);

					scope.selectedDates = [];
					scope.selectRange;

					scope.$parent.$watchCollection(attrs.multiSelect, function (newVal) {
						scope.selectedDates = newVal || [];
					});

					attrs.$observe('selectRange', function (newVal) {
						scope.selectRange = !!newVal && newVal !== "false";
					});

					var ngModelCtrl = ctrls[1];

					ngModelCtrl.$viewChangeListeners.push(function() {
						var newVal = scope.$parent.$eval(attrs.ngModel);
						if(!newVal)
							return;
							
						var dateVal = parseDate($filter('gmISODate')(newVal)).getTime(), //useUTC ? new Date(newVal).setUTCHours(0, 0, 0, 0) : new Date(newVal).setHours(0, 0, 0, 0),
							selectedDates = scope.selectedDates;

						if (scope.selectRange) {
							// reset range
							if (!selectedDates.length || selectedDates.length > 1 || selectedDates[0] == dateVal)
								return selectedDates.splice(0, selectedDates.length, dateVal);

							selectedDates.push(dateVal);

							var tempVal = Math.min.apply(null, selectedDates);
							var maxVal = Math.max.apply(null, selectedDates);

							// Start on the next day to prevent duplicating the	first date
							tempVal += 1000 * 60 * 60 * 24;
							while (tempVal < maxVal) {
								selectedDates.push(tempVal);

								// Set a day ahead after pushing to prevent duplicating last date
								tempVal += 1000 * 60 * 60 * 24;
							}
						} else {
							if (selectedDates.indexOf(dateVal) < 0) {
								selectedDates.push(dateVal);
							} else {
								selectedDates.splice(selectedDates.indexOf(dateVal), 1);
							}
						}
					});
				};
			};

			return $delegate;
		};

		if ($injector.has('datepickerDirective'))
			$provide.decorator('datepickerDirective', ['$delegate', '$filter', datepickerDelegate]);

		if ($injector.has('uibDatepickerDirective'))
			$provide.decorator('uibDatepickerDirective', ['$delegate', '$filter', datepickerDelegate]);

		// extending daypicker (access to day and datepicker scope through $parent)
		var daypickerDelegate = function ($delegate, $filter) {
			var directive = $delegate[0];

			// Override compile
			var link = directive.link;

			directive.compile = function () {
				return function (scope, element, attrs, ctrls) {
					link.apply(this, arguments);

					scope.$parent.$watchCollection('selectedDates', update);

					/*
						Fires when date is selected or when month is changed.
						UI bootstrap versions before 0.14.0 had just one controller DatepickerController,
						now they have UibDatepickerController, UibDaypickerController and DatepickerController
						see more on https://github.com/angular-ui/bootstrap/commit/44354f67e55c571df28b09e26a314a845a3b7397?diff=split#diff-6240fc17e068eaeef7095937a1d63eaeL251
						and https://github.com/angular-ui/bootstrap/commit/44354f67e55c571df28b09e26a314a845a3b7397?diff=split#diff-6240fc17e068eaeef7095937a1d63eaeR462
					*/
					var ctrl = angular.isArray(ctrls) ? ctrls[0] : ctrls;
					scope.$watch(function () {
						return ctrl.activeDate.getTime();
					}, update);
					
					function update() {
					  console.log('update');
						angular.forEach(scope.rows, function (row) {
							angular.forEach(row, function (day) {
								day.selected = scope.selectedDates.indexOf(parseDate($filter('gmISODate')(day.date)).getTime()) > -1;
							});
						});
					}
				};
			};

			return $delegate;
		};

		if ($injector.has('daypickerDirective'))
			$provide.decorator('daypickerDirective', ['$delegate', '$filter', daypickerDelegate]);

		if ($injector.has('uibDaypickerDirective'))
			$provide.decorator('uibDaypickerDirective', ['$delegate', '$filter', daypickerDelegate]);

		// extending datepicker popup (access to attributes and app scope through $parent)
		// NOTES: Need to blank out the active date using the ng-change directive in order to select the same date repeatedly.
		// otherwise nothing happens the second time you click the same date if another date is not clicked in between.
		var datepickerPopupDelegate = function ($delegate, $filter) {
			var directive = $delegate[0];

			// Override compile
			var link = directive.link;

			directive.compile = function () {
				return function (scope, element, attrs, ctrls) {
					link.apply(this, arguments);

					scope.selectedDates = [];
					scope.selectRange;

					scope.$parent.$watchCollection(attrs.multiSelect, function (newVal) {
						scope.selectedDates = newVal || [];
					});

					attrs.$observe('selectRange', function (newVal) {
						scope.selectRange = !!newVal && newVal !== "false";
					});

					var ngModelCtrl = ctrls[0];

					ngModelCtrl.$viewChangeListeners.push(function() {
						var newVal = scope.$parent.$eval(attrs.ngModel);
						if(!newVal)
							return;
							
						var dateVal = parseDate($filter('gmISODate')(newVal)).getTime(), //useUTC ? new Date(newVal).setUTCHours(0, 0, 0, 0) : new Date(newVal).setHours(0, 0, 0, 0),
							selectedDates = scope.selectedDates;

						if (scope.selectRange) {
							// reset range
							if (!selectedDates.length || selectedDates.length > 1 || selectedDates[0] == dateVal)
								return selectedDates.splice(0, selectedDates.length, dateVal);

							selectedDates.push(dateVal);

							var tempVal = Math.min.apply(null, selectedDates);
							var maxVal = Math.max.apply(null, selectedDates);

							// Start on the next day to prevent duplicating the	first date
							tempVal += 1000 * 60 * 60 * 24;
							while (tempVal < maxVal) {
								selectedDates.push(tempVal);

								// Set a day ahead after pushing to prevent duplicating last date
								tempVal += 1000 * 60 * 60 * 24;
							}
						} else {
							if (selectedDates.indexOf(dateVal) < 0) {
								selectedDates.push(dateVal);
							} else {
								selectedDates.splice(selectedDates.indexOf(dateVal), 1);
							}
						}
					});
				};
			};

			return $delegate;
		};

		if ($injector.has('uibDatepickerPopupDirective'))
			$provide.decorator('uibDatepickerPopupDirective', ['$delegate', '$filter', datepickerPopupDelegate]);
	}]);
})(window.angular);
