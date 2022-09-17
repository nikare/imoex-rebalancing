import { useEffect, useState } from 'react';
import axios from 'axios';

import { ILsData, IndexIds, IStock, Services } from './interfaces';
import { INITIAL_DATA, LS_KEY, BASE_URL, INDEX_IDS } from './constants';

export const LS_DATA = localStorage.getItem(LS_KEY);

export const App = () => {
  const [dateTime, setDateTime] = useState<string>();
  const [stocks, setStocks] = useState<IStock[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lsData, setLsData] = useState<typeof INITIAL_DATA>(
    LS_DATA ? { ...INITIAL_DATA, ...JSON.parse(LS_DATA) } : INITIAL_DATA,
  );

  useEffect(() => {
    const url = `${BASE_URL}/${lsData.indexId}.json`;
    const params = `iss.meta=off&limit=1000`;
    axios.get(`${url}?${params}`).then(({ data }) => {
      setDateTime(data['analytics.dates'].data[0][1]);
      setStocks(
        data.analytics.data.map(
          ([_, , ticker, title, , weight]: [any, any, string, string, any, number]) => {
            return { ticker, title, weight, isHidden: lsData.hidden.includes(ticker) };
          },
        ),
      );
      setIsLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsData.indexId]);

  if (!isLoaded || !dateTime) {
    return null;
  }

  const onChecked = () => {
    setLsData((prevState) => {
      const newState = { ...prevState, isAllVisible: !prevState.isAllVisible };
      localStorage.setItem(LS_KEY, JSON.stringify(newState));
      return newState;
    });
  };

  const onChangeSort = () => {
    setLsData((prevState) => {
      const newState = { ...prevState, isWeightSort: !prevState.isWeightSort };
      localStorage.setItem(LS_KEY, JSON.stringify(newState));
      return newState;
    });
  };

  const onChangeService = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const service = event.target.value as ILsData['service'];
    setLsData((prevState) => {
      const newState = { ...prevState, service };
      localStorage.setItem(LS_KEY, JSON.stringify(newState));
      return newState;
    });
  };

  const onChangeIndexId = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const indexId = event.target.value as IndexIds;
    setLsData((prevState) => {
      const newState = { ...prevState, indexId };
      localStorage.setItem(LS_KEY, JSON.stringify(newState));
      return newState;
    });
  };

  const hideOrVisible = (_ticker: string) => {
    setStocks((prevState) => {
      const newStocks = [...prevState];
      const findedIndex = newStocks.findIndex(({ ticker }) => ticker === _ticker);
      newStocks[findedIndex].isHidden = !newStocks[findedIndex].isHidden;
      const hiddenTickets = newStocks
        .filter(({ isHidden }) => isHidden)
        .map(({ ticker }) => ticker);

      setLsData((prevState) => {
        const newState = { ...prevState, hidden: hiddenTickets };
        localStorage.setItem(LS_KEY, JSON.stringify(newState));
        return newState;
      });
      return newStocks;
    });
  };

  const normalizedStocks = stocks
    .map((stock) => {
      const prefStock = stocks.find(({ ticker }) => `${stock.ticker}P` === ticker);
      if (!prefStock) return stock;
      prefStock.isPref = true;
      return {
        ...stock,
        prefTicker: prefStock.ticker,
        weight: Math.floor((stock.weight + prefStock.weight) * 100) / 100,
        withPref: true,
      };
    })
    .filter(({ isPref }) => !isPref);

  const sortedStocks = [...normalizedStocks].sort((a, b) =>
    lsData.isWeightSort ? b.weight - a.weight : 1,
  );

  const filteredStocks = sortedStocks.filter(({ isHidden }) => lsData.isAllVisible || !isHidden);
  const withoutHidden = filteredStocks.filter(({ isHidden }) => !isHidden);
  const isShowedMoreThan10 = withoutHidden.length > 10;

  const totalWeight = withoutHidden.reduce((accum, { weight }) => {
    return Math.round((accum + weight) * 100) / 100;
  }, 0);

  const stakes = filteredStocks.reduce((accum, { ticker, weight, isHidden }, index) => {
    const stake = isHidden ? 0 : Math.round((weight / (totalWeight * 0.01)) * 100) / 100;
    accum[ticker] = stake > 15 ? 15 : stake;

    if (index + 1 >= filteredStocks.length) {
      const total = Object.values(accum).reduce((accum, value) => accum + value, 0);
      accum.total = Math.round(total * 100) / 100;

      let leftValue = Math.round((100 - accum.total) * 100) / 100;

      const distribute = () => {
        const filteredStake = Object.entries(accum)
          .filter(([key, value]) => key !== 'total' && value > 0 && value < 15)
          .sort((a, b) => b[1] - a[1]);

        if (leftValue > 0) {
          for (let i = filteredStake.length; i--; ) {
            if (leftValue <= 0) break;
            const ticker = filteredStake[i][0];
            accum[ticker] = Math.round((accum[ticker] + 0.01) * 100) / 100;
            accum.total = Math.round((accum.total + 0.01) * 100) / 100;
            leftValue = Math.round((leftValue - 0.01) * 100) / 100;
          }
        } else if (leftValue < 0) {
          for (let i = 0; i < filteredStake.length; i++) {
            if (leftValue >= 0) break;
            const ticker = filteredStake[i][0];
            accum[ticker] = Math.round((accum[ticker] - 0.01) * 100) / 100;
            accum.total = Math.round((accum.total - 0.01) * 100) / 100;
            leftValue = Math.round((leftValue + 0.01) * 100) / 100;
          }
        }

        if (leftValue !== 0) {
          distribute();
        }
      };
      distribute();
    }

    return accum;
  }, {} as { [key: string]: number });

  return (
    <div className="app">
      <form className="pure-form">
        <h1>
          <div className="title-wrapper">
            {`${INDEX_IDS[lsData.indexId][1]} - ${INDEX_IDS[lsData.indexId][0]}`}
            <select
              className="title-select"
              value={INDEX_IDS[lsData.indexId][0]}
              onChange={onChangeIndexId}>
              <option value={INDEX_IDS.IMOEX[0]}>{INDEX_IDS.IMOEX[1]}</option>
              <option value={INDEX_IDS.MOEXBC[0]}>{INDEX_IDS.MOEXBC[1]}</option>
              <option value={INDEX_IDS.MOEX10[0]}>{INDEX_IDS.MOEX10[1]}</option>
              <option value={INDEX_IDS.RGBITR[0]}>{INDEX_IDS.RGBITR[1]}</option>
              <option value={INDEX_IDS.RUCBHYTR[0]}>{INDEX_IDS.RUCBHYTR[1]}</option>
              <option value={INDEX_IDS.RUCBITR[0]}>{INDEX_IDS.RUCBITR[1]}</option>
              <option value={INDEX_IDS.RUEYBCSTR[0]}>{INDEX_IDS.RUEYBCSTR[1]}</option>
              <option value={INDEX_IDS.RUMBITR[0]}>{INDEX_IDS.RUMBITR[1]}</option>
            </select>
          </div>
          <span className="date-time">{new Date(dateTime).toLocaleDateString('ru-RU')}г.</span>
        </h1>

        <fieldset>
          <span>Открывать ссылки в </span>
          <select onChange={onChangeService} value={lsData.service}>
            <option value="tinkoff">tinkoff.ru</option>
            <option value="snowball">snowball-income.com</option>
          </select>
        </fieldset>
        <fieldset>
          {normalizedStocks.length > withoutHidden.length && (
            <label>
              <input type="checkbox" onChange={onChecked} checked={lsData.isAllVisible} />
              <span> Показать все</span>
            </label>
          )}
          <span>Сортировать по: </span>
          <select onChange={onChangeSort} value={lsData.isWeightSort ? 'weight' : 'ticker'}>
            <option value="ticker">Тикеру</option>
            <option value="weight">Весу</option>
          </select>
        </fieldset>
      </form>
      <table className="pure-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Тикер</th>
            <th>Название</th>
            <th>Вес в индексе</th>
            <th>Доля в портфеле</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredStocks.map(({ ticker, prefTicker, title, weight, isHidden }, index) => {
            const isSnowball = lsData.service === 'snowball';

            const LINKS: { [key in Services]: string } = {
              tinkoff: `https://www.tinkoff.ru/invest/${INDEX_IDS[lsData.indexId][2]}`,
              snowball: 'https://snowball-income.com/public/asset',
            };

            const link = LINKS[lsData.service];

            const urlAo = isSnowball ? `${link}/${ticker}.MCX` : `${link}/${ticker}/`;
            const urlPref = isSnowball ? `${link}/${prefTicker}.MCX` : `${link}/${prefTicker}/`;

            return (
              <tr key={index} className={isHidden ? 'is-hidden' : ''}>
                <td>{index + 1}</td>
                <td>
                  {prefTicker ? (
                    <div>
                      <a href={urlAo} target="_blank" rel="noreferrer">
                        {ticker}
                      </a>
                      <span> / </span>
                      <a href={urlPref} target="_blank" rel="noreferrer">
                        {prefTicker}
                      </a>
                    </div>
                  ) : (
                    <a href={urlAo} target="_blank" rel="noreferrer">
                      {ticker}
                    </a>
                  )}
                </td>
                <td>{title}</td>
                <td>{weight}%</td>
                <td>{stakes[ticker]}%</td>
                <td>
                  <span className="link" onClick={() => hideOrVisible(ticker)}>
                    {!isHidden ? (isShowedMoreThan10 ? 'убрать' : '') : 'вернуть'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>
              <span>Итого - </span>
              <span>по весу на МосБирже: {totalWeight}%</span>
              <span> | </span>
              <span>по доле в портфеле: {stakes.total}%</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};