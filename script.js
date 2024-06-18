document.addEventListener('DOMContentLoaded', () => {
    const fromCurrencySelect = document.getElementById('fromCurrency');
    const toCurrencySelect = document.getElementById('toCurrency');
    const historyFromCurrencySelect = document.getElementById('historyFromCurrency');
    const historyToCurrencySelect = document.getElementById('historyToCurrency');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const convertButton = document.getElementById('convertButton');
    const historyButton = document.getElementById('historyButton');
    const resultDiv = document.getElementById('result');
    const historyResultDiv = document.getElementById('historyResult');
    const historyChartCtx = document.getElementById('historyChart').getContext('2d');
    let historyChart;

    const fetchCurrencies = async () => {
        try {
            const [responseA, responseB] = await Promise.all([
                fetch('http://api.nbp.pl/api/exchangerates/tables/A/?format=json'),
                fetch('http://api.nbp.pl/api/exchangerates/tables/B/?format=json')
            ]);
            const [dataA, dataB] = await Promise.all([responseA.json(), responseB.json()]);
            const currencies = [...dataA[0].rates, ...dataB[0].rates];

            const uniqueCurrencies = Array.from(new Set(currencies.map(currency => currency.code)))
                .map(code => {
                    return currencies.find(currency => currency.code === code);
                });

            uniqueCurrencies.forEach(currency => {
                const option = document.createElement('option');
                option.value = currency.code;
                option.textContent = `${currency.currency} (${currency.code})`;
                fromCurrencySelect.appendChild(option);
                toCurrencySelect.appendChild(option.cloneNode(true));
                historyFromCurrencySelect.appendChild(option.cloneNode(true));
                historyToCurrencySelect.appendChild(option.cloneNode(true));
            });

            // Add PLN manually
            const plnOption = document.createElement('option');
            plnOption.value = 'PLN';
            plnOption.textContent = 'Polski Złoty (PLN)';
            fromCurrencySelect.appendChild(plnOption.cloneNode(true));
            toCurrencySelect.appendChild(plnOption.cloneNode(true));
            historyFromCurrencySelect.appendChild(plnOption.cloneNode(true));
            historyToCurrencySelect.appendChild(plnOption.cloneNode(true));
        } catch (error) {
            console.error('Błąd podczas pobierania walut:', error);
        }
    };

    const convertCurrency = async () => {
        const amount = document.getElementById('amount').value;
        const fromCurrency = fromCurrencySelect.value;
        const toCurrency = toCurrencySelect.value;
        try {
            const rateFrom = fromCurrency === 'PLN' ? 1 : await getRate(fromCurrency);
            const rateTo = toCurrency === 'PLN' ? 1 : await getRate(toCurrency);

            const result = (amount * rateFrom) / rateTo;
            resultDiv.textContent = `${amount} ${fromCurrency} = ${result.toFixed(2)} ${toCurrency}`;
        } catch (error) {
            console.error('Błąd podczas przeliczania walut:', error);
        }
    };

    const getRate = async (currency) => {
        try {
            if (currency === 'PLN') return 1;

            const responseA = await fetch(`http://api.nbp.pl/api/exchangerates/rates/A/${currency}/?format=json`);
            if (responseA.ok) {
                const dataA = await responseA.json();
                return dataA.rates[0].mid;
            }

            const responseB = await fetch(`http://api.nbp.pl/api/exchangerates/rates/B/${currency}/?format=json`);
            if (responseB.ok) {
                const dataB = await responseB.json();
                return dataB.rates[0].mid;
            }

            throw new Error('No rate found');
        } catch (error) {
            console.error('Błąd podczas pobierania kursu:', error);
        }
    };

    const showHistory = async () => {
        const fromCurrency = historyFromCurrencySelect.value;
        const toCurrency = historyToCurrencySelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!startDate || !endDate) {
            alert('Proszę wybrać przedział czasowy.');
            return;
        }

        try {
            const [ratesFrom, ratesTo] = await Promise.all([
                getHistoricalRates(fromCurrency, startDate, endDate),
                getHistoricalRates(toCurrency, startDate, endDate)
            ]);

            const dates = ratesFrom.map(rate => rate.effectiveDate);
            const exchangeRates = ratesFrom.map((rateFrom, index) => {
                if (ratesTo[index] && ratesTo[index].mid !== undefined) {
                    return rateFrom.mid / ratesTo[index].mid;
                } else {
                    return null; // or handle this case as you need
                }
            }).filter(rate => rate !== null); // filter out null values

            // Usuwamy stare elementy tekstowe
            historyResultDiv.innerHTML = '';

            // Wyświetlamy wykres
            if (historyChart) {
                historyChart.destroy();
            }
            historyChart = new Chart(historyChartCtx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: `Kurs ${fromCurrency}/${toCurrency}`,
                        data: exchangeRates,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Data'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Kurs'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Błąd podczas pobierania historii kursów:', error);
        }
    };

    const getHistoricalRates = async (currency, startDate, endDate) => {
        try {
            if (currency === 'PLN') {
                // Generowanie danych dla PLN w stosunku do innych walut
                const dates = [];
                const currentDate = new Date(startDate);
                const end = new Date(endDate);
                while (currentDate <= end) {
                    dates.push({
                        effectiveDate: currentDate.toISOString().split('T')[0],
                        mid: 1
                    });
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return dates;
            }

            const responseA = await fetch(`http://api.nbp.pl/api/exchangerates/rates/A/${currency}/${startDate}/${endDate}/?format=json`);
            if (responseA.ok) {
                const dataA = await responseA.json();
                return dataA.rates;
            }

            const responseB = await fetch(`http://api.nbp.pl/api/exchangerates/rates/B/${currency}/${startDate}/${endDate}/?format=json`);
            if (responseB.ok) {
                const dataB = await responseB.json();
                return dataB.rates;
            }

            throw new Error('No historical rates found');
        } catch (error) {
            console.error('Błąd podczas pobierania historycznych kursów:', error);
            return [];
        }
    };

    fetchCurrencies();
    convertButton.addEventListener('click', convertCurrency);
    historyButton.addEventListener('click', showHistory);
});
