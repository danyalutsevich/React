import logo from './logo.svg';
import './App.css';
import { BrowserRouter, Route, Routes, NavLink } from 'react-router-dom';
import Item from './Item.jsx'
import Clock from './Clock';
import Chess from './Chess'

function App() {
  return (
    <div className="App">
      <Clock/>
      
      <Chess key="chess"/>
      
    </div>
  );
}

export default App;
