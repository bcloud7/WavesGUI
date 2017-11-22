(function () {
    'use strict';

    const SEARCH_FIELDS = [
        { name: 'sender', strict: false },
        { name: 'recipient', strict: false },
        { name: 'attachment', strict: true },
        { name: 'amount.tokens', strict: false },
        { name: 'timestamp', strict: false }
    ];

    /**
     * @param Base
     * @param {User} user
     * @param i18n
     * @param {AssetsService} assetsService
     * @param {TransactionsService} transactionsService
     * @param {Function} createPoll
     * @param {app.utils} utils
     * @return {TransactionList}
     */
    const controller = function (Base, user, i18n, assetsService, transactionsService, createPoll, utils) {

        class TransactionList extends Base {

            constructor() {
                super();
                /**
                 * @type {Array}
                 */
                this._transactions = null;
                /**
                 * @type {Array}
                 */
                this.transactions = null;
                /**
                 * @type {string}
                 */
                this.transactionType = null;
                /**
                 * @type {string}
                 */
                this.search = null;
                /**
                 * @type {string}
                 */
                this.mirrorId = null;
                /**
                 * @type {IAssetInfo}
                 */
                this.mirror = null;
                /**
                 * @type {boolean}
                 */
                this.hadResponse = false;
                /**
                 * @type {Array}
                 */
                this.assetIdList = null;

                this.mirrorId = user.getSetting('baseAssetId');

                assetsService.getAssetInfo(this.mirrorId)
                    .then((mirror) => {
                        this.mirror = mirror;

                        createPoll(this, this._getTransactions, '_transactions', 4000, { isBalance: true });
                        this.observe(['_transactions', 'transactionType', 'search'], this._onChangeFilters);
                    });

            }

            /**
             * @private
             */
            _getTransactions() {
                return transactionsService.getList()
                    .then((list) => {
                        this.hadResponse = true;
                        return list;
                    });
            }

            /**
             * @private
             */
            _onChangeFilters() {
                const filter = tsUtils.filterList(
                    this._getAssetFilter(),
                    this._getTypeFilter(),
                    this._getSearchFilter()
                );

                const transactions = (this._transactions || []).filter(filter);
                const hash = Object.create(null);
                const toDate = tsUtils.date('DD.MM.YYYY');

                transactions.forEach((transaction) => {
                    const date = toDate(transaction.timestamp);
                    if (!hash[date]) {
                        hash[date] = { timestamp: transaction.timestamp, transactions: [] };
                    }
                    hash[date].transactions.push(transaction);
                });

                const dates = Object.keys(hash)
                    .sort(utils.comparators.process((name) => hash[name].timestamp).desc);

                this.transactions = dates.map((date) => ({
                    transactions: hash[date].transactions,
                    timestamp: hash[date].timestamp,
                    date
                }));
            }

            /**
             * @private
             */
            _getAssetFilter() {
                if (this.assetIdList && this.assetIdList.length) {
                    const TYPES = transactionsService.TYPES;
                    return ({ type, amount }) => {
                        switch (type) {
                            case TYPES.SEND:
                            case TYPES.RECEIVE:
                            case TYPES.CIRCULAR:
                                return this.assetIdList.indexOf(amount.asset.id) !== -1;
                            default:
                                return false;
                        }
                    };
                } else {
                    return () => true;
                }
            }

            /**
             * @return {*}
             * @private
             */
            _getTypeFilter() {
                if (!this.transactionType || this.transactionType === 'all') {
                    return () => true;
                } else {
                    const types = this.transactionType.split(',').map((item) => item.trim());
                    return ({ type }) => types.indexOf(type) !== -1;
                }
            }

            /**
             * @return {function(*=)}
             * @private
             */
            _getSearchFilter() {
                return (transaction) => {
                    return !this.search || SEARCH_FIELDS.some((fieldData) => {
                        const field = tsUtils.get(transaction, fieldData.name);

                        if (!field) {
                            return false;
                        }

                        if (field instanceof Date) {
                            return `${field.getDate()}`.indexOf(this.search) !== -1;
                        }
                        return String(field)
                            .indexOf(this.search) !== -1;
                    });
                };
            }

        }

        return new TransactionList();
    };

    controller.$inject = [
        'Base',
        'user',
        'i18n',
        'assetsService',
        'transactionsService',
        'createPoll',
        'utils'
    ];

    angular.module('app.ui')
        .component('wTransactionList', {
            bindings: {
                assetIdList: '<',
                transactionType: '<',
                search: '<'
            },
            templateUrl: 'modules/ui/directives/transactionList/transactionList.html',
            transclude: false,
            controller
        });
})();