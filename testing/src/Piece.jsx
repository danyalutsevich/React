import React, { Component } from "react";


export default class Piece extends Component {


    constructor(props) {
        super(props)

        this.state = {

            pieceIndex: 3,

        }

    }

    clickPrevious() {
        if (this.state.pieceIndex > 0) {

            this.setState({ pieceIndex: this.state.pieceIndex - 1 })
        }
    }

    clickNext() {
        if (this.state.pieceIndex < this.props.pieces.results.length) {

            this.setState({ pieceIndex: this.state.pieceIndex + 1 })
        }
    }

    getImgSource(index, size) {

        if (index <= 0) {

            return `https://images.navigart.fr/${size}/${this.props.pieces.results[0]._source.ua.artwork.medias[0].file_name}`
        }
        else if (index >= this.props.pieces.results.length) {

            return `https://images.navigart.fr/${size}/${this.props.pieces.results[this.props.pieces.results.length - 1]._source.ua.artwork.medias[0].file_name}`
        }

        return `https://images.navigart.fr/${size}/${this.props.pieces.results[index]._source.ua.artwork.medias[0].file_name}`

    }


    render() {

        const {
            pieceIndex,
        } = this.state

        const aboutPiece = this.props.pieces.results[this.state.pieceIndex]._source.ua.artwork

        return (
            <div className={this.props.className || ""}>
                <button onClick={() => { this.clickPrevious() }} className="previous">

                    <img src={this.getImgSource(pieceIndex - 1, 200)} alt={pieceIndex - 1} />

                </button>

                <button onClick={() => { this.clickNext() }} className="next">

                    <img src={this.getImgSource(pieceIndex + 1, 200)} alt={pieceIndex + 1} />

                </button>

                <div className="current">
                    <div className="currentImage">

                    <img src={this.getImgSource(pieceIndex, 400)} alt={pieceIndex}  />
                    </div>
                    <div className="about">

                        <p>{aboutPiece.title_notice}</p>
                        <p>{aboutPiece.date_creation}</p>
                        <p>{aboutPiece.title_attributed}</p>
                        <p>{aboutPiece.authors_notice}</p>
                        <p>{aboutPiece.authors_birth_death}</p>
                        <p>{aboutPiece.dimensions}</p>
                        <p>{aboutPiece.copyright}</p>

                    </div>
                </div>
            </div>
        )

    }
}


