import React from "react";
import { Component } from "react";
import Piece from "./Piece";

class Item extends Component {

    constructor(props) {
        super(props)
        this.state = {
            pieces: [],
            pieceIndex: 3,
            loading: true,
        }
    }

    componentDidMount() {

        fetch(`https://api.navigart.fr/18/artworks?sort=random&buster=30&size=600&from=${Math.round(Math.random() * 600)}`)
            .then(res => res.json())
            .then(data => {
                this.setState({
                    pieces: data,
                    loading: false,
                })
            })

    }

    render() {

        const {
            pieceIndex,
            pieces,
            loading,
        } = this.state


        if (loading) {
            return (<div>
                <h3>Loading...</h3>
            </div>)
        }


        return (
            <div className="Items">

                <Piece pieces={pieces} key={pieceIndex} pieceIndex={this.state.pieceIndex} className="itemExplorer" />
            </div>
        )
    }
}

export default Item
