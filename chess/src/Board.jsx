import React from "react";
import './Chess.css'
import { Chess } from "chess.js";


export default class Board extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            chess: new Chess(),
            board: [],
            pieces: [],
            files: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
            a: 10,
            b: 20,
            selectedPiece: '',
            from: '',
            to: ''
        }
    }

    fillBoard() {

        const {
            files,
            chess,
        } = this.state;

        // console.log(chess.move('Nf3'))
        // console.log('e4', chess.board())

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
        this.setState({ pieces: chess.board() })

    }


    componentDidMount() {

        this.fillBoard()
    }

    componentDidUpdate() {

        console.log(this.state)

    }

    getPiece(piece) {

        return piece != null ?
            < img src={`./Icons/${piece?.type}.svg`} alt={`${piece?.type}`} className={piece?.color + "Piece"} />
            : null
    }

    onDragStartHandler(e, cell, rindex, cindex) {

        e.target.style.cursor = 'grabbing'
        // console.log("drag", cell, rindex, cindex)

        let piece = this.state.chess.board()[cindex][rindex]

        this.setState({ selectedPiece: piece.type })
        this.setState({ from: piece.square })
        this.setState({ to: '' })

    }

    onDragEnterHandler(e) {

        // e.target.style = "filter:invert(50%)"
    }

    onDragLeaveHandler(e) {

        // e.target.style = "filter:invert(-50%)"
    }

    onDragEndHandler(e) {

        // e.target.style = "filter:invert(-50%)"
    }

    onDragOverHandler(e) {

        e.preventDefault()
    }

    onDropHandler(e, cell) {

        e.preventDefault()

        const {
            selectedPiece,
        } = this.state



        let to = selectedPiece.toUpperCase().concat(cell.file.concat(cell.rank)).replace('P','')


        console.log(to)

        this.state.chess.move(to)

        this.setState({ pieces: this.state.chess.board() })

        // console.log("drop", cell)
    }


    render() {

        const {
            board,
            files,
            pieces
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

                <div className="a" draggable={true} onDragStartCapture={() => { this.setState({ a: "captured" }) }}>{this.state.a}</div>
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

                {board.map((row, rindex) =>
                    <div key={row[0].file}>
                        {row.map((cell, cindex) => {
                            return cell.color === 0 ?

                                <div className="whiteCell" key={cell.file + cell.rank}

                                    onDragStart={(e) => this.onDragStartHandler(e, cell, rindex, cindex)}
                                    onDragEnter={(e) => this.onDragEnterHandler(e)}
                                    onDragLeave={(e) => this.onDragLeaveHandler(e)}
                                    onDragEnd={(e) => this.onDragEndHandler(e)}
                                    onDragOver={(e) => this.onDragOverHandler(e)}
                                    onDrop={(e) => this.onDropHandler(e, cell)}
                                >
                                    {this.getPiece(pieces[cindex][rindex])}
                                </div>

                                :

                                <div className="blackCell" key={cell.file + cell.rank}

                                    onDragStart={(e) => this.onDragStartHandler(e, cell, rindex, cindex)}
                                    onDragEnter={(e) => this.onDragEnterHandler(e)}
                                    onDragLeave={(e) => this.onDragLeaveHandler(e)}
                                    onDragEnd={(e) => this.onDragEndHandler(e)}
                                    onDragOver={(e) => this.onDragOverHandler(e)}
                                    onDrop={(e) => this.onDropHandler(e, cell)}
                                >
                                    {this.getPiece(pieces[cindex][rindex])}
                                </div>
                        })}
                    </div>
                )}
            </div>

        )
    }
}