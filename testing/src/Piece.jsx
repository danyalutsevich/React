import React, { Component } from "react";


export default class Piece extends Component {


    constructor(props) {
        super(props)

        this.state = {
            piece: props.piece,
            media : props.piece._source.ua.artwork.medias[0],
            source: `https://images.navigart.fr/${props.size}/${props.piece._source.ua.artwork.medias[0].file_name}`
        }

    }

    render() {

        const{
            source
        }=this.state

        return (
            <div>
                <img src={source} alt="" />
            </div>
        )

    }
}


