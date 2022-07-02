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

        fetch(`https://api.navigart.fr/18/artworks?sort=random&buster=30&size=600&from=${Math.round(Math.random()*600)}`)
            .then(res => res.json())
            .then(data => {
                this.setState({
                    pieces: data,
                    loading: false,
                })
            })

    }

    clickPrevious() {


        if (this.state.pieceIndex > 0) {

            this.setState({ pieceIndex: this.state.pieceIndex - 1 })
        }
    }

    clickNext() {


        if (this.state.pieceIndex < this.state.pieces.results.length) {

            this.setState({ pieceIndex: this.state.pieceIndex + 1 })
        }
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
            <div>
                <h2>Modern art</h2>

                <h2>Item:{pieceIndex}</h2>
                <h2>{Math.round(Math.random()*600)}</h2>
                <pre>{JSON.stringify(pieces.results[pieceIndex])}</pre>

                <button onClick={() => { this.clickPrevious() }}>

                    <Piece piece={pieces.results[pieceIndex - 1]} key={pieceIndex} size="200"  />

                </button>

                <button onClick={() => { this.clickNext() }}>

                    <Piece piece={pieces.results[pieceIndex + 1]} key={pieceIndex} size="200"  />

                </button>

                <Piece piece={pieces.results[pieceIndex]} key={pieceIndex} size="400"  />

                <>
                    {/* <div>
                    {
                        items.results.map(item =>
                            item._source.ua.artwork.medias.map(image => {
                                var source = `https://images.navigart.fr/${200}/${image.file_name}`
                                
                                return (<img src={source} key={source} />)
                                
                            })
                            )
                        }
                        
                    </div> */}
                </>

            </div>
        )

    }
}

export default Item
