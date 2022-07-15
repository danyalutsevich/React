import { toHaveStyle } from "@testing-library/jest-dom/dist/matchers";
import React from "react";
import { Chess } from "chess.js"

export default class EndGameModal extends React.Component {


    constructor(props) {
        super(props)

        this.state = {

        }






    }


    gameEndsWith() {

        let result = ''
        let by = ''

        if (this.props.isCheckmate) {
            result = this.props.turn == 'b' ? 'White won' : 'Black won'
            by = 'by Checkmate'
        }
        else if (this.props.isDraw) {
            result = 'Draw'
        }

        if (this.props.isStaleMate) {
            by = 'by Stalemate'
        }
        else if (this.props.isInsufficient_material) {
            by = 'by Insufficient material'
        }
        else if (this.props.isIn_threefold_repetition) {
            by = 'by Threefold repetition'
        }


        return (
            <div>
                <h1>{result}</h1>
                <h2>{by}</h2>
            </div>
        )


    }

    render() {

        return (
            <div className="EndGameModalContainer">
                <div className="EndGameModalContent">

                {this.gameEndsWith()}

                </div>
            </div>
        )

    }


}

