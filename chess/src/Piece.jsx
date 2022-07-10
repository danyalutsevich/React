import React from 'react'

export default class Piece extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            piece: props.piece,
        }
    }

     render() {


        return (
            <div className="PieceContainer" draggable={true}>
                {

                    this.props.piece != null ?
                        < img src={`./Icons/${this.props.piece?.type}.svg`} alt={`${this.props.piece?.type}`} className={this.props.piece?.color+"Piece"} draggable={false} />
                        : null

                }
            </div>
        )

    }

}
