import logo from './logo.svg';
import './App.css';
import { BrowserRouter, Route, Routes, NavLink } from 'react-router-dom';
import Item from './Item.jsx'
import Clock from './Clock';

function App() {
  return (
    <div className="App">
      <Clock/>
      <Item/>
    </div>
  );
}

export default App;
