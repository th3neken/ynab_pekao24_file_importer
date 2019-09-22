#!/usr/bin/env node
const argv = require('yargs')
    .usage('Usage $0 <command> [options]')
    .command('add', 'Add transactions to YNAB', yargs => {
        yargs
            .alias('f', 'file')
            .describe('f', 'transactions file from pekao24')
            .demandOption(['f'])
    })
    .command('list', 'List budgets from YNAB')
    .demandCommand()
    .showHelpOnFail(true)
    .epilog('copyright 2019 Łukasz "theneken" Boruń')
    .argv;

const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');
const ynab = require('ynab');


const accessToken = process.env.YNAB_ACCESS_TOKEN;
const accountId = process.env.YNAB_ACCOUNT_ID;
const budgetId = process.env.YNAB_BUDGET_ID;

if (!accessToken || !budgetId || !accountId) {
    throw Error('Environment variables: YNAB_ACCESS_TOKEN && YNAB_BUDGET_ID && YNAB_ACCOUNT_ID are required');
}

(async function () {
    try {
        const ynabAPI = new ynab.API(accessToken);

        if (argv._[0] === 'list') {
            const budgetsResponse = await ynabAPI.budgets.getBudgets();
            const budgets = budgetsResponse.data.budgets;
            for (let budget of budgets) {
                console.log(`[id: ${budget.id}, name: ${budget.name}, last_modified_on: ${budget.last_modified_on}]`);
            }
            return;
        }

        const bankTransactions = [];
        fs.createReadStream(argv.file)
            .pipe(csv({separator: '\t'}))
            .on('data', (data) => bankTransactions.push(data))
            .on('end', async () => {
                const transactions = bankTransactions.map(bt => {
                    const btValues = Object.values(bt);
                    return {
                        account_id: accountId,
                        date: moment(btValues[0]).format('YYYY-MM-DD'),
                        amount: parseInt(btValues[5].replace(',', '.')) * 1000,
                        payee_name: btValues[2].substring(0, 49),
                        cleared: ynab.SaveTransaction.ClearedEnum.Uncleared,
                    }
                });
                await ynabAPI.transactions.createTransactions(budgetId, {transactions});
                console.log(`Processed ${transactions.length} transactions from bank`);
            })
    } catch (err) {
        console.log(err);
    }
})();
