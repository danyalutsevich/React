import React from "react";
import './Chess.css'
import Piece from "./Piece";
import {Chess} from "chess.js";


export default class Board extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            board: [],
            files: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
            a: 10,
            b: 20,
            chess: new Chess(),
        }
    }

    fillBoard() {

        const {
            files,
            chess,
        } = this.state;

        console.log(chess.move('e4'))
        console.log('e4',chess.board())
        let tempBoard = []
        let row = []

        for (let i = 0; i < 8; i++) {
            row = []
            for (let j = 0; j < 8; j++) {

                row.push({ color: (i + j) % 2, file: files[i], rank: 8 - j })
            }
            tempBoard.push(row)
        }

        this.setState({ board: tempBoard })

    }


    componentDidMount() {

        this.fillBoard()
    }

    componentDidUpdate() {

        console.log("board", this.state.board)
    }

    render() {

        const {
            board,
            files,
            chess,
        } = this.state;


        if (board.length === 0) {
            return (<div>
                <p>
                    Board Loading...
                </p>
            </div>)
        }




        return (

            <div className="Board">

                <div className="a" draggable={true} onDragStartCapture={()=>{this.setState({a:"captured"})}}>{this.state.a}</div>
                <div className="b" draggable={true}>{this.state.b}</div>
                <div className="Coordinates">
                    <div className="Ranks">
                        {[...Array(8).keys()].reverse().map((rankNumber) =>
                            <p className="Rank" key={rankNumber + 1}>{rankNumber + 1}</p>

                        )}
                    </div>
                    <div className="Files">
                        {files.map((fileLetter) =>
                            <p className="File" key={fileLetter}>{fileLetter}</p>

                        )}
                    </div>
                </div>

                {board.map((row,rindex) =>
                    <div key={row[0].file}>
                        {row.map((cell,cindex) => {
                            return cell.color === 0 ?
                                <div className="whiteCell" key={cell.file + cell.rank}><Piece piece={chess.board()[cindex][rindex]}/></div> :
                                <div className="blackCell" key={cell.file + cell.rank}><Piece piece={chess.board()[cindex][rindex]}/></div>
                        })}
                    </div>
                )}
            </div>

        )
    }
}