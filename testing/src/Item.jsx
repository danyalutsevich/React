import React from "react";
import { Component } from "react";

class Item extends Component {

    constructor(props) {
        super(props)
        this.state = {
            items: []

        }
    }

    componentDidMount(){
        
        fetch('https://api.navigart.fr/18/artworks?sort=random&buster=30&size=15&from=0')
            .then(res => res.json())
            .then(res => { this.setState({ items: JSON.stringify(res) })})

    }

    render() {

        const{
            items
        }=this.state


        

        return (
            <div>
                <h2>Modern art</h2>
                <h3>{items}</h3>
            </div>
        )

    }
}

export default Item
